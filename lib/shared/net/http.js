// HTTP over a Tor circuit: manual redirect handling (each hop is re-validated),
// cookie handling for sessions, and size-limited body reading.
import { fetch } from "undici";
import { RequestValidationError, ResponseBodyTooLargeError } from "../errors.js";
import { assertRedirectAllowed } from "./destination.js";
import { cookieHeaderFor, storeResponseCookies } from "./sessions.js";

// Headers matching Tor Browser, so requests don't stand out among Tor users.
export function browserHeaders(userAgent) {
  return {
    "user-agent": userAgent,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.5"
  };
}

export function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

// Per RFC 9110 (and what browsers do): 303 always becomes GET; 301/302 turn a
// POST into GET; 307/308 keep the method and body.
export function methodAfterRedirect(status, method) {
  if (status === 303 && method !== "HEAD") return "GET";
  if ((status === 301 || status === 302) && method === "POST") return "GET";
  return method;
}

// Performs a request, following up to `maxRedirects` redirects manually so that
// every hop is validated (`validate` = SSRF guard) and can't escape .onion space.
//
// Returns `{ response, url }` where `url` is the final URL. The caller owns the
// response body and must read or cancel it.
export async function fetchWithRedirects(
  startUrl,
  {
    circuit,
    validate,
    timeoutMs,
    maxRedirects = 10,
    method = "GET",
    headers = {},
    body,
    cookieJar = null
  }
) {
  // One timeout covers the whole redirect chain and body read.
  const signal = AbortSignal.timeout(timeoutMs);
  let url = startUrl instanceof URL ? startUrl : await validate(startUrl);
  let currentMethod = method;
  let currentBody = body;
  const requestHeaders = { ...headers };

  for (let redirects = 0; ; redirects += 1) {
    const hopHeaders = { ...requestHeaders };
    if (cookieJar) {
      const cookie = await cookieHeaderFor(cookieJar, url);
      if (cookie) hopHeaders.cookie = cookie;
    }

    const response = await fetch(url, {
      dispatcher: circuit.dispatcherFor(url),
      method: currentMethod,
      headers: hopHeaders,
      body: currentBody,
      redirect: "manual",
      signal
    });

    if (cookieJar) {
      await storeResponseCookies(cookieJar, url, response);
    }

    const location = response.headers.get("location");
    if (!isRedirectStatus(response.status) || !location) {
      return { response, url };
    }

    await cancelBody(response.body);

    if (redirects >= maxRedirects) {
      throw new RequestValidationError("Too many redirects.");
    }

    const nextUrl = await validate(new URL(location, url).toString());
    assertRedirectAllowed(url, nextUrl);

    const nextMethod = methodAfterRedirect(response.status, currentMethod);
    if (nextMethod !== currentMethod) {
      currentBody = undefined;
      delete requestHeaders["content-type"];
    }
    currentMethod = nextMethod;
    url = nextUrl;
  }
}

const TEXTUAL_CONTENT_TYPES = new Set([
  "application/json",
  "application/xhtml+xml",
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
  "application/ld+json"
]);

export function mediaTypeOf(contentType) {
  return contentType?.split(";")[0]?.trim().toLowerCase() || "";
}

// Rejects binary payloads (images, archives, PDFs...) before they get decoded
// as UTF-8 and mangled. A missing content-type is allowed: some servers omit
// it for plain HTML.
export function isTextualContentType(contentType) {
  const mediaType = mediaTypeOf(contentType);
  return !mediaType || mediaType.startsWith("text/") || TEXTUAL_CONTENT_TYPES.has(mediaType);
}

// Reads the whole body as bytes, aborting as soon as it exceeds `maxBytes`.
export async function readResponseBytes(response, maxBytes) {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) && BigInt(contentLength) > BigInt(maxBytes)) {
    await cancelBody(response.body);
    throw new ResponseBodyTooLargeError(maxBytes);
  }

  if (!response.body) {
    return new Uint8Array(0);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        throw new ResponseBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, byteCount);
}

export async function readResponseText(response, maxBytes) {
  const bytes = await readResponseBytes(response, maxBytes);
  return new TextDecoder("utf-8").decode(bytes);
}

export async function cancelBody(body) {
  try {
    await body?.cancel();
  } catch {
    // Best-effort: the caller already decided it doesn't need the body.
  }
}
