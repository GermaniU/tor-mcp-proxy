# Changelog

## 0.3.0 — first public release

### Security and privacy
- **No more DNS leaks.** Hostnames are no longer resolved locally; Tor resolves them. The old behaviour is available with `TOR_LOCAL_DNS_CHECK=true`, for non-Tor proxies only.
- **Session cookies are scoped to their domain and path** (tough-cookie, RFC 6265). Before this release, a session sent every cookie to every host, including after cross-site redirects.
- **`download_file` writes only inside `TOR_DOWNLOAD_DIR`** (default `~/Downloads/tor-mcp-proxy`). It never overwrites existing files and rejects hidden paths and symlink escapes. Before this release, it could overwrite files in the server's working directory, including its own source code.
- `download_file` no longer accepts HTML or SVG files.
- The default User-Agent now matches Tor Browser instead of Chrome.
- `search_onion` redirects now go through the same checks as every other request.
- The audit log file is created with mode `0600`.
- undici is upgraded to 8.11.2 (fixes published advisories).

### Fixes
- Redirects now follow browser semantics: a `POST` becomes a `GET` on 301, 302 and 303, without the body.
- Relaxed TLS for `.onion` hosts now works for every tool and every redirect hop, not only for `fetch_page` start URLs.
- `download_file` now retries blocked responses. Before, a 403 page was reported as a disallowed content type.
- Session mode no longer retries blocked responses on the same circuit or claims to have used "independent circuits".
- Sessions expire after 30 minutes of inactivity, as documented, instead of 30 minutes after creation.
- `TOR_MAX_DOWNLOAD_BYTES` is now honoured.
- Link extraction handles nested tags, HTML entities, unquoted attributes and relative links (new `base_url` parameter).
- DuckDuckGo result links are unwrapped to their real target URLs.

### Internal
- The code is reorganised into vertical slices (`lib/features/<tool>/`) on top of a shared kernel (`lib/shared/`), with dependencies injected from one composition root (`lib/app/`). See `docs/ARCHITECTURE.md`.
- HTML scanning is linear time, so hostile pages can no longer stall the server.
- Each network tool is tested end to end against a local HTTP server (no Tor needed), alongside unit tests and an MCP protocol test.
- CI tests Node 22 and 24 and runs `npm audit`.
- Added `SECURITY.md`, `CONTRIBUTING.md`, `CLAUDE.md`, issue/PR templates, Dependabot, client config examples and this changelog.

## 0.2.0
- Sticky sessions, POST/PUT/PATCH, `search_onion`, `download_file`, `extract_links`, `page_metadata`.

## 0.1.0
- First release: `fetch_page` and `check_exit_ip` through Tor, with per-request circuit isolation and retries, and `.onion` support.
