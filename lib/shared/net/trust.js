// Runtime trust-store checks.
//
// Clearnet HTTPS through a Tor exit node is verified with Node's own bundled
// root store, and the exit node sits on-path by design. Node releases before
// 22.23.4 / 24.22.1 / 26.12.1 still trust "emSign ECC Root CA - G3", whose
// TLS intermediates had recoverable private keys (October 2026), and do not
// block those intermediates' public keys. A malicious exit could forge a
// certificate for any host that those Node versions accept.
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";

// Minimum patched release per supported major (NSS 3.131.1 roots + nodejs/node#66871).
export const PATCHED_NODE = Object.freeze({ 22: [23, 4], 24: [22, 1], 26: [12, 1] });

// SHA-256 fingerprints of roots removed in NSS 3.131.1.
export const DISTRUSTED_ROOTS = Object.freeze({
  "86:A1:EC:BA:08:9C:4A:8D:3B:BE:27:34:C6:12:BA:34:1D:81:3E:04:3C:F9:E8:A8:62:CD:5C:57:A3:6B:BE:6B": "emSign ECC Root CA - G3",
  "12:56:09:AA:30:1D:A0:A2:49:B9:7A:82:39:CB:6A:34:21:6F:44:DC:AC:9F:39:54:B1:42:92:F2:E8:C8:60:8F": "emSign Root CA - C1",
  "BC:4D:80:9B:15:18:9D:78:DB:3E:1D:8C:F4:F9:72:6A:79:5D:A1:64:3C:A5:F1:35:8E:1D:DB:0E:DC:0D:7E:B3": "emSign ECC Root CA - C3"
});

export function isPatchedNode(version = process.versions.node) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (major > 26) return true;
  const min = PATCHED_NODE[major];
  if (!min) return false; // 23.x, 25.x and older majors are end-of-life without the fix
  return minor > min[0] || (minor === min[0] && patch >= min[1]);
}

// Names of distrusted roots present in Node's bundled store.
export function distrustedBundledRoots(roots = rootCertificates) {
  return roots
    .map((pem) => DISTRUSTED_ROOTS[new X509Certificate(pem).fingerprint256])
    .filter(Boolean);
}

// Human-readable reasons why this runtime must not serve clearnet HTTPS
// through Tor; empty when it is safe. Used by index.js before stdio opens.
export function runtimeTrustProblems({ version = process.versions.node, roots = rootCertificates } = {}) {
  const problems = [];
  if (!isPatchedNode(version)) {
    problems.push(`Node.js ${version} is below the patched release (requires 22.23.4, 24.22.1 or 26.12.1+)`);
  }
  const distrusted = distrustedBundledRoots(roots);
  if (distrusted.length > 0) problems.push(`Node.js still trusts distrusted root(s): ${distrusted.join(", ")}`);
  return problems;
}
