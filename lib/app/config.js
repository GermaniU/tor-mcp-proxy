// Runtime configuration, read from environment variables by the composition
// root (lib/app/server.js) and passed down explicitly — no module reads
// process.env on its own. Every value has a safe default; see README.md.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

// Parses an env-var-style integer with a fallback and inclusive bounds, so
// operators can tune limits without touching code.
export function parseBoundedInt(rawValue, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function parseBoolean(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  return !/^(0|false|no|off)$/i.test(rawValue.trim());
}

export function loadConfig(env = process.env) {
  return Object.freeze({
    serverName: packageJson.name,
    serverVersion: packageJson.version,

    // Tor SOCKS5 endpoint. Hostnames are sent to the proxy unresolved, so Tor
    // (not the local resolver) performs DNS resolution.
    socksUrl: env.TOR_SOCKS5 || "socks5://127.0.0.1:9050",

    // A random SOCKS username/password per call makes Tor route it over an
    // independent circuit (IsolateSOCKSAuth). Disable for non-Tor proxies that
    // treat those fields as real credentials.
    rotateIdentity: parseBoolean(env.TOR_ROTATE_IDENTITY, true),

    // Resolve hostnames locally to reject private addresses. OFF by default
    // because it leaks every visited hostname to the local DNS resolver. Only
    // useful when TOR_SOCKS5 points at a non-Tor proxy.
    localDnsCheck: parseBoolean(env.TOR_LOCAL_DNS_CHECK, false),

    maxRetries: parseBoundedInt(env.TOR_MAX_RETRIES, 3, { min: 0, max: 5 }),
    retryBackoffMs: 250,
    requestTimeoutMs: parseBoundedInt(env.TOR_REQUEST_TIMEOUT_MS, 45_000, { min: 1_000, max: 120_000 }),
    maxRedirects: 10,
    maxResponseBytes: parseBoundedInt(env.TOR_MAX_RESPONSE_BYTES, 1_048_576, { min: 1_024, max: 10_485_760 }),
    maxDownloadBytes: parseBoundedInt(env.TOR_MAX_DOWNLOAD_BYTES, 10_485_760, { min: 1_024, max: 52_428_800 }),

    // download_file never writes outside this directory.
    downloadDir: resolve(env.TOR_DOWNLOAD_DIR || join(homedir(), "Downloads", "tor-mcp-proxy")),

    // Matches Tor Browser (Firefox ESR on Windows) so requests blend in with
    // the largest Tor user population instead of standing out as Chrome-over-Tor.
    userAgent: env.TOR_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0",

    // Opt-in JSONL audit log. Empty string disables logging.
    logPath: env.TOR_LOG_PATH || "",

    sessionTtlMs: 30 * 60 * 1000,
    maxSessions: 100
  });
}

