// The single network "port" that features depend on.
//
// Features never touch undici, SOCKS or the retry policy directly; they get a
// WebClient from the composition root (lib/app/server.js). Tests swap in a
// client whose circuits talk to a local HTTP server instead of Tor.
import { assertAllowedDestination } from "./destination.js";
import { browserHeaders, fetchWithRedirects, readResponseBytes, readResponseText } from "./http.js";
import { withRetries } from "./tor.js";

export class WebClient {
  constructor({
    newCircuit,
    userAgent,
    timeoutMs,
    maxRetries,
    retryBackoffMs,
    maxResponseBytes,
    validate = (url) => assertAllowedDestination(url)
  }) {
    this.newCircuit = newCircuit;
    this.userAgent = userAgent;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryBackoffMs = retryBackoffMs;
    this.maxResponseBytes = maxResponseBytes;
    this.validate = validate;
  }

  // Throws RequestValidationError if the URL may not be requested.
  assertAllowed(url) {
    return this.validate(url);
  }

  // Runs `attempt(circuit)` with the retry policy. Pass a session to pin its
  // circuit (see withRetries for the semantics).
  run(attempt, { session = null } = {}) {
    return withRetries(attempt, {
      newCircuit: this.newCircuit,
      circuit: session?.circuit ?? null,
      maxRetries: this.maxRetries,
      backoffMs: this.retryBackoffMs
    });
  }

  // One request (following redirects) on `circuit`. Returns { response, url }.
  fetch(circuit, url, { method, headers = {}, body, cookieJar } = {}) {
    return fetchWithRedirects(url, {
      circuit,
      validate: this.validate,
      timeoutMs: this.timeoutMs,
      method,
      headers: { ...browserHeaders(this.userAgent), ...headers },
      body,
      cookieJar
    });
  }

  readText(response, maxBytes = this.maxResponseBytes) {
    return readResponseText(response, maxBytes);
  }

  readBytes(response, maxBytes) {
    return readResponseBytes(response, maxBytes);
  }
}
