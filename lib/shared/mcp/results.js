// Builders for MCP tool results. Every tool returns `success(...)` or
// `failure(...)`; text is truncated so a huge page can't flood the client.
import { RequestValidationError, ResponseBodyTooLargeError } from "../errors.js";

export const MAX_OUTPUT_CHARACTERS = 60_000;

export function truncate(text, maxCharacters = MAX_OUTPUT_CHARACTERS) {
  return text.length <= maxCharacters ? text : text.slice(0, maxCharacters);
}

export function success(text) {
  return { content: [{ type: "text", text: truncate(text) }] };
}

export function failure(text) {
  return { content: [{ type: "text", text: truncate(text) }], isError: true };
}

export function validationFailure(zodError) {
  const details = zodError.issues
    .map((issue) => `${issue.path.length === 0 ? "input" : issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  return failure(`Invalid input: ${details}`);
}

export function statusFailure(status) {
  if (status === 403) {
    return failure("HTTP 403: The destination site blocked the request. The exit node may be flagged.");
  }

  if (status === 429) {
    return failure("HTTP 429: Rate limited. Wait before retrying.");
  }

  if (status === 502 || status === 503 || status === 504) {
    return failure(`HTTP ${status}: The destination is temporarily unavailable, or the exit node could not reach it.`);
  }

  return failure(`Request failed with HTTP ${status}. Verify the destination is available and retry.`);
}

// Turns any thrown error into a user-facing failure without leaking stack
// traces or internal details.
export function errorFailure(error) {
  if (error instanceof RequestValidationError) {
    return failure(error.message);
  }

  if (error instanceof ResponseBodyTooLargeError) {
    return failure(`${error.message} Request a smaller resource.`);
  }

  if (isTimeout(error)) {
    return failure("Request timed out. Tor may be slow right now; retry, or raise TOR_REQUEST_TIMEOUT_MS.");
  }

  if (isProxyUnreachable(error)) {
    return failure("Could not connect to the Tor SOCKS5 proxy. Verify Tor is running and reachable at the configured address.");
  }

  return failure("Network request failed. Check the destination and Tor proxy availability, then retry.");
}

function isTimeout(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

export function isProxyUnreachable(error) {
  return error?.code === "ECONNREFUSED" || error?.cause?.code === "ECONNREFUSED";
}
