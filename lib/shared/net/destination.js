// Decides whether a URL may be requested at all (SSRF guard), and whether a
// redirect from one URL to another is acceptable.
//
// Through Tor, hostnames are resolved by the exit relay — never locally — and
// Tor itself refuses to connect to private/internal addresses. So by default
// this module checks only what can be checked WITHOUT a DNS lookup: scheme,
// credentials, literal IPs and well-known local hostnames. Resolving locally
// would leak every visited hostname to the local resolver (a "DNS leak").
// Set TOR_LOCAL_DNS_CHECK=true to also resolve and check hostnames, which is
// only useful when TOR_SOCKS5 points at a non-Tor proxy.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { RequestValidationError } from "../errors.js";

// A Tor v3 onion service address: 56 base32 characters (a-z2-7) + ".onion".
// It is a self-certifying hash of the service's public key, so it can't be
// crafted to alias a private IP the way a DNS record can.
const ONION_V3_PATTERN = /^[a-z2-7]{56}\.onion$/;

export function isOnionHostname(hostname) {
  return ONION_V3_PATTERN.test(hostname);
}

export function normalizeHostname(url) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

export function isOnionUrl(url) {
  return isOnionHostname(normalizeHostname(url));
}

export async function assertAllowedDestination(
  value,
  { localDnsCheck = false, resolve = lookup } = {}
) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new RequestValidationError("The URL is invalid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RequestValidationError("Only HTTP and HTTPS URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new RequestValidationError("URLs with credentials are not allowed.");
  }

  const hostname = normalizeHostname(url);

  if (isOnionHostname(hostname)) {
    return url;
  }

  if (isForbiddenHostname(hostname)) {
    throw new RequestValidationError("The destination must not use a local, private, or metadata hostname.");
  }

  if (isIP(hostname) !== 0) {
    if (!isPublicAddress(hostname)) {
      throw new RequestValidationError("The destination must be a public address.");
    }
    return url;
  }

  if (localDnsCheck) {
    let addresses;
    try {
      addresses = await resolve(hostname, { all: true, verbatim: true });
    } catch {
      throw new RequestValidationError("The destination host could not be resolved.");
    }

    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new RequestValidationError("The destination must resolve only to public addresses.");
    }
  }

  return url;
}

// A request that enters through an onion service must not silently leave
// Tor's address space through a redirect.
export function assertRedirectAllowed(fromUrl, toUrl) {
  if (isOnionUrl(fromUrl) && !isOnionUrl(toUrl)) {
    throw new RequestValidationError("Redirects from .onion services to clearnet destinations are blocked.");
  }
}

export function isForbiddenHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa") ||
    hostname === "metadata" ||
    hostname === "instance-data"
  );
}

export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address) {
  const [first, second] = address.split(".").map(Number);

  if (first === 0 || first === 10 || first === 127 || first >= 224) return false; // this-net, private, loopback, multicast/reserved
  if (first === 100 && second >= 64 && second <= 127) return false; // CGNAT
  if (first === 169 && second === 254) return false; // link-local / cloud metadata
  if (first === 172 && second >= 16 && second <= 31) return false; // private
  if (first === 192 && (second === 0 || second === 168)) return false; // IETF / private
  if (first === 198 && (second === 18 || second === 19 || second === 51)) return false; // benchmarking / docs
  return !(first === 203 && second === 0); // docs
}

function isPublicIpv6(address) {
  const normalized = address.toLowerCase();
  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:") || // IPv4-mapped
    normalized.startsWith("100:") || // discard
    normalized.startsWith("2001:0:") || // Teredo
    normalized.startsWith("2001:db8:") || // docs
    normalized.startsWith("2002:") || // 6to4
    normalized.startsWith("3fff:") || // docs
    normalized.startsWith("64:ff9b:") // NAT64
  ) {
    return false;
  }

  return (
    (firstHextet & 0xfe00) !== 0xfc00 && // unique local
    (firstHextet & 0xffc0) !== 0xfe80 && // link-local
    (firstHextet & 0xff00) !== 0xff00 // multicast
  );
}
