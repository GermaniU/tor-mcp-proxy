# Architecture

`tor-mcp-proxy` is organised as **vertical slices** (one folder per tool) on top of a small **shared kernel**. A single **composition root** wires them together. Dependencies only point inward: features depend on `shared/`, `shared/` depends on nothing project-specific, and only `app/` knows how everything fits together.

```
            index.js (stdio entry point)
                      │
                      ▼
 ┌───────────────── lib/app/ ─────────────────┐   composition root
 │ config.js  reads env vars → plain object   │   (the only place that
 │ server.js  builds the context, registers   │    knows concrete classes)
 │            each feature with the MCP SDK   │
 └────────────────────────────────────────────┘
                      │ context = { web, sessions, downloads, auditLog }
                      ▼
 ┌───────────────── lib/features/ ────────────┐   vertical slices
 │ fetch-page/     schema.js  index.js        │   each folder holds its schema,
 │ check-exit-ip/  index.js                   │   handler and private helpers
 │ search-onion/   index.js  parse-results.js │
 │ download-file/  index.js  storage.js       │
 │ extract-links/  index.js  extract.js       │
 │ page-metadata/  index.js  metadata.js      │
 └────────────────────────────────────────────┘
                      │ imports
                      ▼
 ┌───────────────── lib/shared/ ──────────────┐   shared kernel
 │ net/web-client.js   WebClient (the port)   │   no global state,
 │ net/tor.js          Circuit, retry policy  │   no process.env,
 │ net/http.js         redirects, body limits │   everything injected
 │ net/sessions.js     session store, cookies │
 │ net/destination.js  SSRF / .onion rules    │
 │ html/text.js        HTML → text            │
 │ html/elements.js    linear element scanner │
 │ mcp/results.js      success / failure      │
 │ mcp/schema-types.js shared zod types       │
 │ errors.js  log.js                          │
 └────────────────────────────────────────────┘
```

## Principles applied

| Principle | How it shows up |
|---|---|
| **Vertical slice** | Everything about one tool lives in `lib/features/<tool>/`: its input schema, handler and any helper only it uses, such as the DuckDuckGo parser or the download storage rules. Adding or removing a tool touches one folder plus one line in `features/index.js`. |
| **Single responsibility** | Each shared module does one thing. `tor.js` handles circuits and retries, `http.js` handles redirects and body limits, `destination.js` decides what may be requested, and `sessions.js` stores sessions. |
| **Dependency inversion** | Features depend on the `WebClient` port and the `context` object, never on undici, SOCKS or `process.env`. `app/server.js` builds the concrete implementations and injects them. |
| **Open/closed** | New tools plug in without changing the server: `server.js` loops over `features/index.js`. |
| **Interface segregation** | A handler receives only `(input, context)` and uses only what it needs. The offline tools ignore `context` entirely. |
| **No hidden state** | Configuration is a frozen object passed down from `loadConfig()`. Shared modules never read environment variables. |

## Life of a `fetch_page` call

1. **`app/server.js`** validates the input against `features/fetch-page/schema.js`, writes an audit log entry (only when `TOR_LOG_PATH` is set), then calls `fetchPage(input, context)`.
2. **`features/fetch-page/index.js`** calls `web.assertAllowed(url)`. That check lives in `shared/net/destination.js` and makes **no DNS lookup** unless `TOR_LOCAL_DNS_CHECK` is on.
3. `web.run(attempt, { session })` applies the retry policy from `shared/net/tor.js`:
   - each attempt gets a **new circuit**, meaning a new SOCKS identity and therefore a new exit node;
   - an attempt returns `{ done: false }` when it was blocked (403, 429, 502, 503 or 504), and then it is retried;
   - validation errors, oversized bodies and a Tor daemon that is down are never retried;
   - with a session, the session's circuit is reused, so only network errors are retried.
4. `web.fetch(circuit, url, …)` calls `fetchWithRedirects` in `shared/net/http.js`. For each hop it:
   - picks the dispatcher: strict TLS for clearnet hosts, relaxed TLS only for `.onion` hosts;
   - sends and stores cookies through the session's cookie jar, which is scoped per domain;
   - on a redirect, validates the next URL again, blocks any move from `.onion` to clearnet, and applies browser method rules (POST becomes GET on 301, 302 and 303).
5. The body is read with a size limit, converted to text and truncated to 60 000 characters.

## Key design decisions

| Decision | Reason |
|---|---|
| No local DNS by default | Resolving locally would leak every hostname to your DNS resolver. Tor resolves hostnames at the exit relay, and exit relays refuse private addresses. |
| One `Circuit` = one SOCKS identity | Tor's `IsolateSOCKSAuth` setting maps each username/password pair to its own circuit, so a new identity gives a new exit node without restarting Tor. |
| Two dispatchers per circuit | undici sets TLS options per dispatcher. Keeping relaxed TLS in a separate `.onion`-only dispatcher means clearnet HTTPS can never skip certificate checks by accident. |
| Manual redirects | Every hop must pass the destination check and the `.onion` rule. |
| `tough-cookie` | Correct domain and path scoping, plus the Public Suffix List, is security-sensitive and easy to get wrong. |
| Linear HTML scanner instead of regex | Regexes like `<a[^>]*>([\s\S]*?)</a>` become quadratic on malformed input, so a hostile page could stall the server. `html/elements.js` scans each character a constant number of times. |

## Testing

All tests run offline, without Tor. The suites live under `test/`:

- `test/shared/*.test.js`: unit tests for the shared kernel.
- `test/features/network-tools.test.js`: each network tool end to end. It uses the **production wiring** (`createContext`), but its circuits talk to a local HTTP server from `test/support.js` instead of Tor. This covers retries, sessions, cookies, downloads and search.
- `test/features/server.test.js`: the full MCP protocol over an in-memory transport.

## Adding a tool

1. Create `lib/features/<tool>/index.js`, exporting `{ name, definition, schema, logFields, handler }`. Put any helper only this tool uses in the same folder.
2. If the tool needs the network, use `context.web` (`assertAllowed`, `run`, `fetch`, `readText`, `readBytes`). Never import undici directly.
3. Add the tool to `lib/features/index.js`.
4. Add tests in `test/features/`. `createTestContext()` from `test/support.js` gives you a working context with no Tor needed.
5. Document the tool in `README.md`.
