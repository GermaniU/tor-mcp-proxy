// The network tools end to end, with the production wiring but circuits that
// talk to a local HTTP server instead of Tor.
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { checkExitIp } from "../../lib/features/check-exit-ip/index.js";
import { downloadFile } from "../../lib/features/download-file/index.js";
import { fetchPage } from "../../lib/features/fetch-page/index.js";
import { searchOnion } from "../../lib/features/search-onion/index.js";
import { createTestContext, redirect, sendJson, startServer } from "../support.js";

let server;
let hits = new Map();

before(async () => {
  server = await startServer((request, response) => {
    const path = new URL(request.url, "http://x").pathname;
    hits.set(path, (hits.get(path) ?? 0) + 1);

    switch (path) {
      case "/page":
        response.writeHead(200, { "content-type": "text/html" });
        return response.end("<h1>Hello</h1><script>evil()</script><p>World</p>");
      case "/flaky":
        // Blocked twice, then OK: simulates a flagged exit node.
        if (hits.get(path) <= 2) return response.writeHead(403).end();
        response.writeHead(200, { "content-type": "text/plain" });
        return response.end("finally");
      case "/always-blocked":
        return response.writeHead(403).end();
      case "/login":
        return redirect(response, 303, "/me", { "set-cookie": "sid=abc; Path=/" });
      case "/me":
        response.writeHead(200, { "content-type": "text/plain" });
        return response.end(`cookie=${request.headers.cookie ?? "none"} method=${request.method}`);
      case "/image":
        response.writeHead(200, { "content-type": "image/png" });
        return response.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      case "/big.pdf":
        response.writeHead(200, { "content-type": "application/pdf" });
        return response.end(Buffer.alloc(4_096));
      case "/ip":
        return sendJson(response, 200, { ip: "203.0.113.7" });
      case "/search":
        response.writeHead(200, { "content-type": "text/html" });
        return response.end(
          `<h2 class="result__title"><a href="https://a.example/">A</a></h2><a class="result__snippet">q=${new URLSearchParams(request.bodyText).get("q")}</a>`
        );
      default:
        response.writeHead(404).end();
    }
  });
});

after(() => server.close());

const text = (result) => result.content[0].text;

test("fetch_page returns readable text", async () => {
  const { context } = await createTestContext();
  const result = await fetchPage({ url: server.url("/page") }, context);
  assert.equal(text(result), "Hello\n\nWorld");
});

test("fetch_page retries a blocked response on new circuits", async () => {
  hits = new Map();
  const { context, circuitsCreated } = await createTestContext();
  const result = await fetchPage({ url: server.url("/flaky"), raw: true }, context);
  assert.equal(text(result), "finally");
  assert.equal(circuitsCreated(), 3);
});

test("fetch_page gives up after the retry budget", async () => {
  const { context } = await createTestContext();
  const result = await fetchPage({ url: server.url("/always-blocked") }, context);
  assert.equal(result.isError, true);
  assert.match(text(result), /HTTP 403.*after 3 attempts/);
});

test("fetch_page sessions keep cookies across calls and follow POST->GET", async () => {
  const { context } = await createTestContext();
  const login = await fetchPage(
    { url: server.url("/login"), method: "POST", body: "u=1", content_type: "application/x-www-form-urlencoded", session_id: "s" },
    context
  );
  assert.equal(text(login), "cookie=sid=abc method=GET");

  const later = await fetchPage({ url: server.url("/me"), session_id: "s" }, context);
  assert.equal(text(later), "cookie=sid=abc method=GET");

  const otherSession = await fetchPage({ url: server.url("/me"), session_id: "other" }, context);
  assert.equal(text(otherSession), "cookie=none method=GET");
});

test("fetch_page rejects binary content", async () => {
  const { context } = await createTestContext();
  const result = await fetchPage({ url: server.url("/image") }, context);
  assert.match(text(result), /non-text content type \(image\/png\)/);
});

test("download_file saves allowed files and enforces the size limit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tor-mcp-dl-"));
  const { context } = await createTestContext({ downloadsDirectory: directory });

  const saved = await downloadFile({ url: server.url("/image"), output_path: "img/logo.png" }, context);
  assert.match(text(saved), /Downloaded 4 bytes to img\/logo.png/);
  assert.deepEqual([...(await readFile(join(directory, "img/logo.png")))], [0x89, 0x50, 0x4e, 0x47]);

  const again = await downloadFile({ url: server.url("/image"), output_path: "img/logo.png" }, context);
  assert.match(text(again), /already exists/);

  const tooBig = await downloadFile({ url: server.url("/big.pdf"), output_path: "big.pdf" }, context);
  assert.match(text(tooBig), /exceeds the 1,024 byte limit/);

  const html = await downloadFile({ url: server.url("/page"), output_path: "page.html" }, context);
  assert.match(text(html), /not allowed/);
});

test("check_exit_ip parses the IP service response", async () => {
  const { context } = await createTestContext();
  const result = await checkExitIp({}, context, { endpoint: server.url("/ip") });
  assert.equal(text(result), "Exit IP: 203.0.113.7");
});

test("search_onion posts the query and formats results", async () => {
  const { context } = await createTestContext();
  const result = await searchOnion({ query: "tor & más" }, context, { endpoint: server.url("/search") });
  assert.equal(text(result), "Found 1 result(s) via DuckDuckGo (.onion):\n\n1. A\n   https://a.example/\n   q=tor & más");
});
