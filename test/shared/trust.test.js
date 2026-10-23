import assert from "node:assert/strict";
import test from "node:test";
import { distrustedBundledRoots, isPatchedNode } from "../../lib/shared/net/trust.js";

test("isPatchedNode enforces the patched minimum per major", () => {
  for (const v of ["22.23.4", "22.24.0", "24.22.1", "24.23.0", "26.12.1", "27.0.0"]) assert.equal(isPatchedNode(v), true, v);
  for (const v of ["22.19.0", "22.23.3", "23.11.0", "24.21.0", "24.22.0", "25.9.0", "26.12.0", "20.19.5"]) {
    assert.equal(isPatchedNode(v), false, v);
  }
});

test("running Node does not bundle the distrusted emSign roots", () => {
  assert.deepEqual(
    distrustedBundledRoots(),
    [],
    `Node ${process.versions.node} still trusts compromised emSign roots; upgrade to 22.23.4, 24.22.1 or 26.12.1+`
  );
  assert.equal(isPatchedNode(), true, `Node ${process.versions.node} lacks the eMudhra key blocklist`);
});
