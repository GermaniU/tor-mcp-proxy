import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, parseBoolean, parseBoundedInt } from "../../lib/app/config.js";

test("parseBoundedInt falls back on missing/invalid input and clamps to bounds", () => {
  assert.equal(parseBoundedInt(undefined, 5), 5);
  assert.equal(parseBoundedInt("", 5), 5);
  assert.equal(parseBoundedInt("abc", 5), 5);
  assert.equal(parseBoundedInt("10", 5, { min: 0, max: 8 }), 8);
  assert.equal(parseBoundedInt("-3", 5, { min: 0, max: 8 }), 0);
  assert.equal(parseBoundedInt("7", 5, { min: 0, max: 8 }), 7);
});

test("parseBoolean understands common false spellings", () => {
  assert.equal(parseBoolean(undefined, true), true);
  for (const value of ["false", "FALSE", "0", "no", "off"]) assert.equal(parseBoolean(value, true), false);
  for (const value of ["true", "1", "yes"]) assert.equal(parseBoolean(value, false), true);
});

test("defaults are privacy-preserving", () => {
  const config = loadConfig({});
  assert.equal(config.localDnsCheck, false, "no local DNS lookups by default (prevents DNS leaks)");
  assert.equal(config.rotateIdentity, true);
  assert.equal(config.logPath, "");
  assert.match(config.userAgent, /Firefox/);
  assert.equal(config.socksUrl, "socks5://127.0.0.1:9050");
});

test("download directory and limits are configurable", () => {
  const config = loadConfig({ TOR_DOWNLOAD_DIR: "/tmp/x", TOR_MAX_DOWNLOAD_BYTES: "2048", TOR_LOCAL_DNS_CHECK: "true" });
  assert.equal(config.downloadDir, "/tmp/x");
  assert.equal(config.maxDownloadBytes, 2048);
  assert.equal(config.localDnsCheck, true);
});
