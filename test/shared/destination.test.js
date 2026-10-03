import assert from "node:assert/strict";
import test from "node:test";
import { assertAllowedDestination, assertRedirectAllowed, isOnionHostname, isPublicAddress } from "../../lib/shared/net/destination.js";
import { RequestValidationError } from "../../lib/shared/errors.js";

const ONION = "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion";
const failIfCalled = () => assert.fail("DNS must not be resolved locally");

test("isOnionHostname accepts only Tor v3 addresses", () => {
  assert.equal(isOnionHostname(ONION), true);
  assert.equal(isOnionHostname("expyuzz4wqqyqhjn.onion"), false, "v2 addresses are obsolete");
  assert.equal(isOnionHostname(`x${ONION}`), false);
  assert.equal(isOnionHostname("example.com"), false);
});

test("hostnames are NOT resolved locally by default (no DNS leak)", async () => {
  const url = await assertAllowedDestination("https://example.com/path", { resolve: failIfCalled });
  assert.equal(url.hostname, "example.com");
});

test("rejects non-HTTP schemes, credentials and local hostnames without DNS", async () => {
  const cases = [
    "file:///etc/passwd",
    "ftp://example.com/",
    "https://user:pass@example.com/",
    "http://localhost:8080/",
    "http://router.local/",
    "http://metadata.google.internal/",
    "http://printer.home.arpa/"
  ];
  for (const value of cases) {
    await assert.rejects(assertAllowedDestination(value, { resolve: failIfCalled }), RequestValidationError, value);
  }
});

test("rejects private and special literal IPs", async () => {
  const cases = [
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://2130706433/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/"
  ];
  for (const value of cases) {
    await assert.rejects(assertAllowedDestination(value), RequestValidationError, value);
  }
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("onion addresses skip all address checks", async () => {
  const url = await assertAllowedDestination(`http://${ONION}/`, { localDnsCheck: true, resolve: failIfCalled });
  assert.equal(url.hostname, ONION);
});

test("optional local DNS check rejects hosts resolving to private addresses", async () => {
  const resolve = async () => [{ address: "10.1.2.3", family: 4 }];
  await assert.rejects(
    assertAllowedDestination("https://evil.example/", { localDnsCheck: true, resolve }),
    /public addresses/
  );

  const publicResolve = async () => [{ address: "93.184.216.34", family: 4 }];
  await assertAllowedDestination("https://example.com/", { localDnsCheck: true, resolve: publicResolve });
});

test("redirects may not leave .onion space", () => {
  const onion = new URL(`http://${ONION}/`);
  assert.throws(() => assertRedirectAllowed(onion, new URL("https://example.com/")), /clearnet/);
  assertRedirectAllowed(onion, new URL(`https://${ONION}/`));
  assertRedirectAllowed(new URL("https://example.com/"), onion);
});
