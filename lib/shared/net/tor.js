// Tor circuits and the retry policy.
//
// A "circuit" here is one SOCKS5 identity (random username/password). Tor's
// default IsolateSOCKSAuth puts each identity on its own circuit, so a new
// identity means a new exit node. Hostnames are passed to Tor unresolved.
import { randomBytes } from "node:crypto";
import { Socks5ProxyAgent } from "undici";
import { RequestValidationError, ResponseBodyTooLargeError } from "../errors.js";
import { errorFailure, isProxyUnreachable } from "../mcp/results.js";
import { isOnionUrl } from "./destination.js";

export function randomIdentity() {
  return randomBytes(8).toString("hex");
}

export function buildProxyUrl(identity, { socksUrl, rotateIdentity }) {
  if (!rotateIdentity) {
    return socksUrl;
  }

  const proxyUrl = new URL(socksUrl);
  proxyUrl.username = identity;
  proxyUrl.password = identity;
  return proxyUrl.toString();
}

// Owns the undici dispatchers for one circuit. Both share the same SOCKS
// identity (and therefore the same Tor circuit):
//  - strict: normal certificate verification (all clearnet HTTPS)
//  - onion:  accepts self-signed certificates, used ONLY for .onion hosts,
//            whose address already authenticates the server.
export class Circuit {
  constructor(identity, proxyUrl) {
    this.identity = identity;
    this.proxyUrl = proxyUrl;
    this.dispatchers = new Map();
  }

  dispatcherFor(url) {
    const kind = isOnionUrl(url) ? "onion" : "strict";
    let dispatcher = this.dispatchers.get(kind);

    if (!dispatcher) {
      const options = kind === "onion" ? { requestTls: { rejectUnauthorized: false } } : {};
      dispatcher = new Socks5ProxyAgent(this.proxyUrl, options);
      this.dispatchers.set(kind, dispatcher);
    }

    return dispatcher;
  }

  async close() {
    const closing = [...this.dispatchers.values()].map((dispatcher) => dispatcher.destroy().catch(() => {}));
    this.dispatchers.clear();
    await Promise.all(closing);
  }
}

// Returns `newCircuit()`, which opens a circuit with a fresh identity.
export function createCircuitFactory({ socksUrl, rotateIdentity }) {
  return () => {
    const identity = randomIdentity();
    return new Circuit(identity, buildProxyUrl(identity, { socksUrl, rotateIdentity }));
  };
}

// HTTP statuses worth retrying on a fresh circuit: a different exit node is
// often not flagged, and gateway failures can clear on a different route.
export function isBlockedStatus(status) {
  return status === 403 || status === 429 || status === 502 || status === 503 || status === 504;
}

export function isRetryableError(error) {
  if (error instanceof RequestValidationError || error instanceof ResponseBodyTooLargeError) {
    return false;
  }

  // The local Tor daemon is down — a new circuit won't help.
  return !isProxyUnreachable(error);
}

// Runs `attempt(circuit)` until it reports `done`, at most `maxRetries` extra
// times. `attempt` returns `{ done, result }`; `done: false` means "blocked or
// transient, worth another try".
//
// - Without `circuit`: every attempt gets a brand-new circuit (new exit node).
// - With `circuit` (session mode): the same circuit is reused, so only network
//   errors are retried — a blocked exit node would stay blocked.
export async function withRetries(attempt, { newCircuit, circuit: fixedCircuit = null, maxRetries, backoffMs }) {
  for (let attemptNumber = 0; ; attemptNumber += 1) {
    const circuit = fixedCircuit ?? newCircuit();
    let outcome;

    try {
      const { done, result } = await attempt(circuit);
      outcome = { result, retry: !done && !fixedCircuit };
    } catch (error) {
      outcome = { result: errorFailure(error), retry: isRetryableError(error) };
    } finally {
      if (!fixedCircuit) await circuit.close();
    }

    if (!outcome.retry || attemptNumber >= maxRetries) {
      return annotateAttempts(outcome.result, attemptNumber + 1, Boolean(fixedCircuit));
    }

    await sleep(backoffMs * (attemptNumber + 1));
  }
}

function annotateAttempts(result, attempts, sameCircuit) {
  if (attempts === 1 || !result.isError) {
    return result;
  }

  const where = sameCircuit ? "on the session's circuit" : "on independent Tor circuits";
  const [first, ...rest] = result.content;
  return {
    ...result,
    content: [{ ...first, text: `${first.text} (still failing after ${attempts} attempts ${where})` }, ...rest]
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
