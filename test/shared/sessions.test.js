import assert from "node:assert/strict";
import test from "node:test";
import { SessionStore } from "../../lib/shared/net/sessions.js";

let circuits = 0;
const newCircuit = () => ({ identity: `c${(circuits += 1)}`, close: async () => {} });

function clock() {
  let now = 0;
  return { now: () => now, advance: (ms) => (now += ms) };
}

test("the same session_id returns the same circuit and cookie jar", () => {
  const store = new SessionStore({ newCircuit, ttlMs: 1_000, maxSessions: 10 });
  const first = store.getOrCreate("a");
  assert.equal(store.getOrCreate("a"), first);
  assert.notEqual(store.getOrCreate("b").circuit.identity, first.circuit.identity);
});

test("sessions expire after inactivity, and use extends them", () => {
  const time = clock();
  const store = new SessionStore({ newCircuit, ttlMs: 100, maxSessions: 10, now: time.now });
  const session = store.getOrCreate("a");

  time.advance(80);
  assert.equal(store.getOrCreate("a"), session, "still alive");
  time.advance(80);
  assert.equal(store.getOrCreate("a"), session, "sliding expiry");
  time.advance(101);
  assert.notEqual(store.getOrCreate("a"), session, "expired -> new session");
});

test("the least recently used session is evicted at capacity", () => {
  const time = clock();
  const store = new SessionStore({ newCircuit, ttlMs: 1_000, maxSessions: 2, now: time.now });
  store.getOrCreate("a");
  time.advance(1);
  store.getOrCreate("b");
  time.advance(1);
  store.getOrCreate("a");
  time.advance(1);
  store.getOrCreate("c");

  assert.equal(store.size, 2);
  assert.equal(store.has("a"), true);
  assert.equal(store.has("b"), false);
});
