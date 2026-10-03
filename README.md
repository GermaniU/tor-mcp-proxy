# tor-mcp-proxy

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants (Claude Code, Claude Desktop, OpenCode, …) browse the web **through Tor**, including `.onion` hidden services.

- **Every call on a fresh Tor circuit**: each tool call gets its own exit node, and calls can't be linked through a shared circuit.
- **No DNS leaks**: hostnames are resolved by Tor, never by your local resolver.
- **`.onion` support**: works with Tor v3 hidden services, including those with self-signed HTTPS certificates.
- **Automatic retries**: blocked or rate-limited responses (403/429/5xx) are retried on a new circuit.
- **Sticky sessions**: pass a `session_id` to log in or fill forms across several requests, with domain-scoped cookies.
- **Safe defaults**: SSRF guard, response size limits, a sandboxed download directory and no logging unless enabled.

> ⚠️ This tool hides your IP from the sites you visit. It is **not** Tor Browser and does not give the same anonymity guarantees. Read [SECURITY.md](SECURITY.md) before relying on it.

Forked from [DataImpulse-MCP](https://github.com/Gentleman-Programming/dataimpulse-mcp) (MIT).

---

## Contents

- [Quick start](#quick-start)
- [Connect your client](#connect-your-client)
- [Tools](#tools)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Development](#development)
- [Limitations](#limitations)

## Quick start

### 1. Install and start Tor

```bash
# macOS
brew install tor && brew services start tor

# Debian / Ubuntu
sudo apt install tor && sudo systemctl enable --now tor
```

Check that Tor is listening on `127.0.0.1:9050`:

```bash
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip
# {"IsTor":true,"IP":"..."}
```

### 2. Install the server

Requires **Node.js 22.19+**.

```bash
git clone https://github.com/GermaniU/tor-mcp-proxy.git
cd tor-mcp-proxy
npm ci
npm test            # optional: runs offline, no Tor needed
```

## Connect your client

### Claude Code

```bash
claude mcp add tor-proxy --scope user -- node /absolute/path/to/tor-mcp-proxy/index.js
```

### Claude Desktop

Add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tor-proxy": {
      "command": "node",
      "args": ["/absolute/path/to/tor-mcp-proxy/index.js"],
      "env": { "TOR_DOWNLOAD_DIR": "/absolute/path/to/downloads" }
    }
  }
}
```

### OpenCode

```json
{
  "mcp": {
    "tor-proxy": {
      "type": "local",
      "command": ["node", "/absolute/path/to/tor-mcp-proxy/index.js"]
    }
  }
}
```

Ready-to-copy configs for Claude Desktop, Cursor and OpenCode are in [`examples/`](examples/).

## Tools

| Tool | Network | What it does |
|---|---|---|
| [`fetch_page`](#fetch_page) | Tor | Fetches a page and returns its text or raw HTML |
| [`check_exit_ip`](#check_exit_ip) | Tor | Shows the IP address that sites see |
| [`search_onion`](#search_onion) | Tor | Searches through DuckDuckGo's `.onion` service |
| [`download_file`](#download_file) | Tor | Saves a document, image or archive to the download directory |
| [`extract_links`](#extract_links) | none | Lists the links found in some HTML |
| [`page_metadata`](#page_metadata) | none | Summarises some HTML: title, headings, links, forms and meta tags |

### `fetch_page`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | — | HTTP(S) or `.onion` URL |
| `raw` | boolean | `false` | Return raw HTML instead of extracted text |
| `method` | `GET` \| `POST` \| `PUT` \| `PATCH` | `GET` | HTTP method |
| `body` | string | — | Request body (required for non-GET, not allowed for GET) |
| `content_type` | string | — | Required for non-GET: `application/x-www-form-urlencoded`, `application/json`, `text/plain` or `multipart/form-data` |
| `session_id` | string | — | Reuses the same circuit and cookie jar across calls |

- Binary responses (images, PDFs, …) are rejected; use `download_file` for those.
- Redirects are followed as a browser would follow them. A `POST` becomes a `GET` on 301, 302 and 303, and every hop is checked again. A redirect from a `.onion` site to a clearnet site is blocked.
- **Sessions:**
  - A `session_id` pins one circuit and one cookie jar.
  - Cookies are only sent back to the domain and path that set them.
  - A session expires after 30 minutes without use, and at most 100 sessions are kept.
  - Requests in a session stay on the same circuit, so a blocked response is not retried on a new exit node. Only network errors are retried.

### `check_exit_ip`

Takes no parameters and returns `Exit IP: x.x.x.x` for a fresh circuit.

### `search_onion`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | — | 1–500 characters |
| `limit` | integer | `20` | 1–50 |

Searches through DuckDuckGo's official onion service (`duckduckgogg42…onion`), so the search never leaves Tor. Results can include both clearnet and `.onion` sites.

### `download_file`

| Parameter | Type | Description |
|---|---|---|
| `url` | string | File URL |
| `output_path` | string | Path relative to the download directory, e.g. `reports/q3.pdf` |

- Files are written **only** inside `TOR_DOWNLOAD_DIR`. The default is `~/Downloads/tor-mcp-proxy`.
- Existing files are never overwritten.
- Each path segment must start with a letter, digit or `_`, and may contain only letters, digits, `.`, `_`, `-` and spaces. This rules out `..`, hidden files and absolute paths. Symlinks that point outside the directory are refused.
- Allowed content types: PDF, Office documents, PNG/JPEG/GIF/WebP, ZIP/TAR/GZIP/BZIP2/7z/RAR, plain text, CSV, JSON and XML. HTML, SVG and executables are rejected.
- The size limit is 10 MiB by default (`TOR_MAX_DOWNLOAD_BYTES`).

### `extract_links`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `html` | string | — | HTML to scan (up to 500 kB) |
| `filter_onion` | boolean | `true` | Only return `.onion` links |
| `base_url` | string | — | Resolves relative links (without it they are skipped) |

### `page_metadata`

| Parameter | Type | Description |
|---|---|---|
| `html` | string | HTML to analyse |
| `url` | string | Optional page URL, used to classify links as internal or external |

## Configuration

All settings are environment variables and all of them are optional.

| Variable | Default | Description |
|---|---|---|
| `TOR_SOCKS5` | `socks5://127.0.0.1:9050` | Address of the Tor SOCKS5 proxy |
| `TOR_ROTATE_IDENTITY` | `true` | Uses a random SOCKS username/password per call, which gives each call its own circuit. Set it to `false` only for non-Tor proxies. |
| `TOR_LOCAL_DNS_CHECK` | `false` | Also resolves hostnames **locally** to reject private IPs. ⚠️ This leaks every hostname to your DNS resolver. Enable it only with a non-Tor proxy. |
| `TOR_MAX_RETRIES` | `3` | Extra attempts on a new circuit after a block or a network error (0–5) |
| `TOR_REQUEST_TIMEOUT_MS` | `45000` | Timeout per attempt, covering redirects and the body (1000–120000) |
| `TOR_MAX_RESPONSE_BYTES` | `1048576` | Maximum page size for `fetch_page` and `search_onion` |
| `TOR_MAX_DOWNLOAD_BYTES` | `10485760` | Maximum file size for `download_file` (up to 50 MiB) |
| `TOR_DOWNLOAD_DIR` | `~/Downloads/tor-mcp-proxy` | The only directory `download_file` writes to |
| `TOR_USER_AGENT` | Tor Browser (Firefox 140 ESR) | User-Agent header sent with every request |
| `TOR_LOG_PATH` | *(off)* | Path of a JSONL audit log. ⚠️ It records URLs and search queries. |

## How it works

```
MCP client ──stdio──▶ index.js ─▶ lib/app/server.js ─▶ lib/features/<tool>/
                                                        │  uses context.web
                     lib/shared/net: validate URL → retry on new circuit →
                                     fetch + manual redirects + cookies
                                                        │
                                            Tor SOCKS5 ─▶ exit node ─▶ site
```

The code is organised as vertical slices (one folder per tool) over a small shared kernel, with dependencies injected from a single composition root. For details, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Development

```bash
npm run check        # syntax check for all files
npm test             # unit and integration tests (offline: local HTTP server, no Tor)
npm run list-tools   # starts the server and prints the registered tools
```

To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Limitations

- Requests do not look exactly like Tor Browser. The User-Agent matches, but the TLS and HTTP/2 fingerprints are Node's. Sites can tell this is not Tor Browser.
- JavaScript is not executed, so pages that render on the client return little text.
- Tor is slow: expect 2–10 s per request, and more when retries happen.
- Many sites block Tor exit nodes, and retries help only some of the time.
- Plain-HTTP clearnet traffic can be read and modified by the exit node. Prefer HTTPS.

## License

[MIT](LICENSE)
