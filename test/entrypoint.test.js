// Spawns the real entry point (index.js) over stdio, without Tor: an accepted
// runtime must answer MCP initialize + tools/list; a rejected runtime must
// exit non-zero with the reason on stderr and nothing on stdout.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const entry = new URL("../index.js", import.meta.url).pathname;
const fixture = (name) => new URL(`./fixtures/runtime/${name}`, import.meta.url).href;
// Port 9 (discard) on loopback: nothing in these tests may reach Tor.
const env = { ...process.env, TOR_SOCKS5: "socks5h://127.0.0.1:9", TOR_LOG_PATH: "" };

const messages = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "entrypoint-test", version: "0.0.0" } }
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" }
];

const parse = (stdout) =>
  stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

// Runs index.js with optional --import preloads. Closes stdin once the
// tools/list reply arrives (or immediately if the process exits first).
function runEntrypoint(preloads = [], timeoutMs = 10_000) {
  const args = [...preloads.flatMap((name) => ["--import", fixture(name)]), entry];
  const child = spawn(process.execPath, args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdout += chunk;
    if (parse(stdout.slice(0, stdout.lastIndexOf("\n") + 1)).some((m) => m.id === 2)) child.stdin.end();
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.on("error", () => {}); // a rejected runtime exits without reading stdin
  for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`index.js did not exit within ${timeoutMs} ms; stderr: ${stderr}`));
    }, timeoutMs);
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

test("entrypoint serves MCP over stdio on an accepted runtime", async () => {
  const { code, stdout, stderr } = await runEntrypoint();
  const replies = parse(stdout);
  assert.equal(replies.find((m) => m.id === 1)?.result?.serverInfo?.name, "tor-mcp-proxy", `stdout: ${stdout}\nstderr: ${stderr}`);
  assert.equal(replies.find((m) => m.id === 2)?.result?.tools?.length, 6, stdout);
  assert.doesNotMatch(stderr, /refusing to start/);
  assert.equal(code, 0, stderr);
});

test("entrypoint refuses an unpatched Node.js version before opening stdio", async () => {
  const { code, stdout, stderr } = await runEntrypoint(["unpatched-version.js"]);
  assert.equal(code, 1, stderr);
  assert.equal(stdout, "", "stdout must stay clean: no MCP message from a rejected runtime");
  assert.match(stderr, /refusing to start: Node\.js 24\.21\.0 is below the patched release/);
  assert.doesNotMatch(stderr, /distrusted root/);
});

test("entrypoint refuses a root store that still trusts emSign roots", async () => {
  const { code, stdout, stderr } = await runEntrypoint(["distrusted-root.js"]);
  assert.equal(code, 1, stderr);
  assert.equal(stdout, "", "stdout must stay clean: no MCP message from a rejected runtime");
  assert.match(stderr, /refusing to start: Node\.js still trusts distrusted root\(s\): emSign ECC Root CA - G3/);
  assert.doesNotMatch(stderr, /below the patched release/);
});
