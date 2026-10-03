import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CookieJar } from "tough-cookie";
import { ResponseBodyTooLargeError } from "../../lib/shared/errors.js";
import {
  fetchWithRedirects,
  isTextualContentType,
  methodAfterRedirect,
  readResponseBytes,
  readResponseText
} from "../../lib/shared/net/http.js";
import { allowAll, directCircuit, redirect, sendJson, startServer } from "../support.js";

let server;

before(async () => {
  server = await startServer((request, response) => {
    const path = new URL(request.url, "http://x").pathname;
    const echo = () =>
      sendJson(response, 200, {
        method: request.method,
        body: request.bodyText,
        contentType: request.headers["content-type"] ?? null,
        cookie: request.headers.cookie ?? null
      });

    switch (path) {
      case "/echo":
        return echo();
      case "/see-other":
        return redirect(response, 303, "/echo");
      case "/temporary":
        return redirect(response, 307, "/echo");
      case "/found":
        return redirect(response, 302, "/echo");
      case "/loop":
        return redirect(response, 302, "/loop");
      case "/login":
        return redirect(response, 302, "/echo", { "set-cookie": "sid=secret; Path=/; HttpOnly" });
      case "/login-then-leave":
        // Same server, different hostname: the cookie must not follow.
        return redirect(response, 302, server.url("/echo", "localhost"), { "set-cookie": "sid=secret; Path=/" });
      default:
        response.writeHead(404).end();
    }
  });
});

after(() => server.close());

async function request(path, options = {}) {
  const { response, url } = await fetchWithRedirects(server.url(path), {
    circuit: directCircuit,
    validate: allowAll,
    timeoutMs: 5_000,
    ...options
  });
  return { url: url.toString(), status: response.status, data: JSON.parse(await readResponseText(response, 100_000)) };
}

test("methodAfterRedirect follows RFC 9110 / browser behaviour", () => {
  assert.equal(methodAfterRedirect(303, "POST"), "GET");
  assert.equal(methodAfterRedirect(303, "PUT"), "GET");
  assert.equal(methodAfterRedirect(302, "POST"), "GET");
  assert.equal(methodAfterRedirect(301, "POST"), "GET");
  assert.equal(methodAfterRedirect(302, "PUT"), "PUT");
  assert.equal(methodAfterRedirect(307, "POST"), "POST");
  assert.equal(methodAfterRedirect(308, "PATCH"), "PATCH");
});

test("303 after POST becomes GET and drops the body", async () => {
  const { data, url } = await request("/see-other", {
    method: "POST",
    body: "a=1",
    headers: { "content-type": "application/x-www-form-urlencoded" }
  });
  assert.equal(url, server.url("/echo"));
  assert.deepEqual(data, { method: "GET", body: "", contentType: null, cookie: null });
});

test("307 keeps the method and body", async () => {
  const { data } = await request("/temporary", { method: "POST", body: "a=1", headers: { "content-type": "text/plain" } });
  assert.equal(data.method, "POST");
  assert.equal(data.body, "a=1");
  assert.equal(data.contentType, "text/plain");
});

test("redirect loops stop with a validation error", async () => {
  await assert.rejects(request("/loop", { maxRedirects: 3 }), /Too many redirects/);
});

test("every redirect hop is validated", async () => {
  const validate = async (value) => {
    const url = new URL(value);
    if (url.pathname === "/echo") throw new Error("blocked hop");
    return url;
  };
  await assert.rejects(
    fetchWithRedirects(server.url("/found"), { circuit: directCircuit, validate, timeoutMs: 5_000 }),
    /blocked hop/
  );
});

test("session cookies are stored and sent back to the same host", async () => {
  const cookieJar = new CookieJar();
  const { data } = await request("/login", { cookieJar });
  assert.equal(data.cookie, "sid=secret");

  const again = await request("/echo", { cookieJar });
  assert.equal(again.data.cookie, "sid=secret");
});

test("session cookies are NOT sent to a different host", async () => {
  const cookieJar = new CookieJar();
  const { data, url } = await request("/login-then-leave", { cookieJar });
  assert.match(url, /localhost/);
  assert.equal(data.cookie, null);
});

function fakeResponse(chunks, headers = {}) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    }
  });
  return new Response(body, { headers });
}

test("readResponseText decodes UTF-8 split across chunks", async () => {
  const bytes = new TextEncoder().encode("héllo");
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      }
    })
  );
  assert.equal(await readResponseText(response, 100), "héllo");
});

test("body limits are enforced from Content-Length and while streaming", async () => {
  await assert.rejects(readResponseBytes(fakeResponse(["x"], { "content-length": "999" }), 10), ResponseBodyTooLargeError);
  await assert.rejects(readResponseBytes(fakeResponse(["12345", "67890", "1"]), 10), ResponseBodyTooLargeError);
  assert.equal((await readResponseBytes(fakeResponse(["12345", "67890"]), 10)).byteLength, 10);
});

test("isTextualContentType allows text-like types and rejects binary", () => {
  for (const type of [null, "", "text/html; charset=utf-8", "application/json", "application/xhtml+xml"]) {
    assert.equal(isTextualContentType(type), true, String(type));
  }
  for (const type of ["image/png", "application/pdf", "application/octet-stream", "video/mp4"]) {
    assert.equal(isTextualContentType(type), false, type);
  }
});
