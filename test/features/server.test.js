// End-to-end through the MCP protocol (in-memory transport, no Tor needed):
// tool registration, input validation and the offline tools.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../lib/app/server.js";

let client;

before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
});

after(() => client.close());

const call = (name, args) => client.callTool({ name, arguments: args });
const text = (result) => result.content[0].text;

test("all tools are registered", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "check_exit_ip",
    "download_file",
    "extract_links",
    "fetch_page",
    "page_metadata",
    "search_onion"
  ]);
});

test("fetch_page refuses private destinations before touching the network", async () => {
  const result = await call("fetch_page", { url: "http://127.0.0.1:9050/" });
  assert.equal(result.isError, true);
  assert.match(text(result), /public address/);
});

test("fetch_page reports schema errors clearly", async () => {
  const result = await call("fetch_page", { url: "https://example.com", method: "POST" });
  assert.equal(result.isError, true);
  assert.match(text(result), /body/);
});

test("download_file rejects unsafe paths before touching the network", async () => {
  const result = await call("download_file", { url: "https://example.com/a.pdf", output_path: "../../.bashrc" });
  assert.equal(result.isError, true);
  assert.match(text(result), /Invalid output_path/);
});

test("extract_links groups links by host", async () => {
  const html = '<a href="https://a.example/1">One</a><a href="https://a.example/2">Two</a><a href="/rel">Rel</a>';
  const result = await call("extract_links", { html, filter_onion: false, base_url: "https://b.example/" });
  assert.equal(
    text(result),
    "Found 3 links across 2 hosts:\n\n" +
      "a.example (2 links):\n  1. One — https://a.example/1\n  2. Two — https://a.example/2\n\n" +
      "b.example (1 link):\n  1. Rel — https://b.example/rel"
  );
});

test("page_metadata summarises a page", async () => {
  const result = await call("page_metadata", { html: "<title>Hi</title><h1>Head</h1>", url: "https://example.com/" });
  assert.match(text(result), /Title: Hi/);
  assert.match(text(result), /H1 \(1\): Head/);
});
