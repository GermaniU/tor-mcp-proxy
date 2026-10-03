// Sticky sessions for fetch_page: one Tor circuit + one cookie jar per
// `session_id`, so multi-step flows (login, forms, pagination) look like a
// single visitor.
//
// Cookies are handled by tough-cookie (RFC 6265 + public suffix list), so a
// cookie is only ever sent back to the domain/path that set it.
import { CookieJar } from "tough-cookie";

export class SessionStore {
  constructor({ newCircuit, ttlMs, maxSessions, now = Date.now }) {
    this.newCircuit = newCircuit;
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.now = now;
    this.sessions = new Map();
  }

  // Returns the live session for `id`, creating it if missing or expired.
  // Expiry is sliding: every use pushes it back by `ttlMs`.
  getOrCreate(id) {
    this.evictExpired();

    let session = this.sessions.get(id);
    if (!session) {
      this.evictLeastRecentlyUsedIfFull();
      session = { circuit: this.newCircuit(), cookies: new CookieJar(), lastUsedAt: this.now() };
      this.sessions.set(id, session);
    }

    session.lastUsedAt = this.now();
    return session;
  }

  has(id) {
    return this.sessions.has(id);
  }

  get size() {
    return this.sessions.size;
  }

  evictExpired() {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, session] of this.sessions) {
      if (session.lastUsedAt < cutoff) this.delete(id);
    }
  }

  evictLeastRecentlyUsedIfFull() {
    if (this.sessions.size < this.maxSessions) return;

    let oldestId = null;
    let oldestTime = Infinity;
    for (const [id, session] of this.sessions) {
      if (session.lastUsedAt < oldestTime) {
        oldestTime = session.lastUsedAt;
        oldestId = id;
      }
    }
    if (oldestId !== null) this.delete(oldestId);
  }

  delete(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    session.circuit.close();
  }
}

// Note: tough-cookie decides "secure context" from the URL (https or
// localhost), so `Secure` cookies are not sent to plain-http .onion sites.
// That is the conservative choice; https .onion sites work normally.
export async function cookieHeaderFor(jar, url) {
  const header = await jar.getCookieString(url.toString());
  return header || null;
}

export async function storeResponseCookies(jar, url, response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookies) {
    // ignoreError: a malformed or foreign-domain cookie is dropped, not fatal.
    await jar.setCookie(setCookie, url.toString(), { ignoreError: true });
  }
}
