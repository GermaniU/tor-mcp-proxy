# CLAUDE.md — tor-mcp-proxy

Project conventions for AI coding assistants (and humans).

## Stack

- **Node.js 22.19+**, ES modules, MCP SDK over stdio, undici (SOCKS5), zod, tough-cookie.
- **Vertical slice architecture**: each tool lives in `lib/features/<tool>/`. Shared code is in `lib/shared/`, and wiring is in `lib/app/`. See `docs/ARCHITECTURE.md`.
- **Tests**: `npm test` runs offline in about 2 s, with no Tor. `npm run check` syntax-checks every file.

## Rules

- **Privacy first**: no traffic or DNS outside the Tor proxy, and no logging of request bodies, cookies or session ids. A change that weakens `SECURITY.md` must be opt-in and documented there.
- **Layering** (enforced by `test/architecture.test.js`):
  - features use `context.web` and never import undici;
  - `shared/` never reads `process.env` and never imports from `features/` or `app/`;
  - a feature never imports another feature.
- **DIP**: dependencies are injected from `lib/app/server.js`. Tests use `createTestContext()` from `test/support.js`.
- **YAGNI**: no speculative abstractions. Add a dependency only when it replaces security-sensitive code.
- Identifiers, comments and docs are in **English**. Commits use **Conventional Commits**.

## Anti-drift rule for docs

Every PR that adds, changes or removes a tool or a `TOR_*` variable must update `README.md` and `CHANGELOG.md` in the same diff.
