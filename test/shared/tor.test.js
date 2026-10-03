import assert from "node:assert/strict";
import test from "node:test";
import { RequestValidationError } from "../../lib/shared/errors.js";
import { failure, success } from "../../lib/shared/mcp/results.js";
import { buildProxyUrl, Circuit, createCircuitFactory, isBlockedStatus, withRetries } from "../../lib/shared/net/tor.js";

const newCircuit = createCircuitFactory({ socksUrl: "socks5://127.0.0.1:9050", rotateIdentity: true });
const fast = { newCircuit, maxRetries: 2, backoffMs: 0 };

test("buildProxyUrl puts a per-call identity in the SOCKS credentials", () => {
  assert.equal(
    buildProxyUrl("abc", { socksUrl: "socks5://127.0.0.1:9050", rotateIdentity: true }),
    "socks5://abc:abc@127.0.0.1:9050"
  );
  assert.equal(
    buildProxyUrl("abc", { socksUrl: "socks5://127.0.0.1:9050", rotateIdentity: false }),
    "socks5://127.0.0.1:9050"
  );
});

test("Circuit uses the relaxed-TLS dispatcher only for .onion hosts", async () => {
  const circuit = new Circuit("id", "socks5://127.0.0.1:9050");
  const onion = circuit.dispatcherFor(new URL("https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/"));
  const clear = circuit.dispatcherFor(new URL("https://example.com/"));
  assert.notEqual(onion, clear);
  assert.equal(circuit.dispatcherFor(new URL("https://example.org/")), clear);
  await circuit.close();
});

test("isBlockedStatus flags statuses worth retrying", () => {
  for (const status of [403, 429, 502, 503, 504]) assert.equal(isBlockedStatus(status), true);
  for (const status of [200, 301, 400, 404, 500]) assert.equal(isBlockedStatus(status), false);
});

test("blocked responses are retried, each on a new circuit", async () => {
  const identities = [];
  const result = await withRetries(async (circuit) => {
    identities.push(circuit.identity);
    return identities.length < 3 ? { done: false, result: failure("blocked") } : { done: true, result: success("ok") };
  }, fast);

  assert.equal(result.content[0].text, "ok");
  assert.equal(new Set(identities).size, 3);
});

test("final failure says how many circuits were tried", async () => {
  const result = await withRetries(async () => ({ done: false, result: failure("blocked") }), fast);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /after 3 attempts on independent Tor circuits/);
});

test("validation errors are never retried", async () => {
  let calls = 0;
  const result = await withRetries(async () => {
    calls += 1;
    throw new RequestValidationError("bad input");
  }, fast);
  assert.equal(calls, 1);
  assert.equal(result.content[0].text, "bad input");
});

test("a down Tor daemon fails fast", async () => {
  let calls = 0;
  const result = await withRetries(async () => {
    calls += 1;
    throw Object.assign(new Error("refused"), { code: "ECONNREFUSED" });
  }, fast);
  assert.equal(calls, 1);
  assert.match(result.content[0].text, /Tor SOCKS5 proxy/);
});

test("session mode keeps the circuit and does not retry blocked statuses", async () => {
  const circuit = new Circuit("session", "socks5://127.0.0.1:9050");
  let calls = 0;
  const blocked = await withRetries(async () => {
    calls += 1;
    return { done: false, result: failure("blocked") };
  }, { ...fast, circuit });
  assert.equal(calls, 1);
  assert.equal(blocked.content[0].text, "blocked");

  const seen = [];
  const network = await withRetries(async (used) => {
    seen.push(used);
    throw new Error("socket hang up");
  }, { ...fast, circuit });
  assert.ok(seen.every((used) => used === circuit));
  assert.match(network.content[0].text, /on the session's circuit/);
  await circuit.close();
});
