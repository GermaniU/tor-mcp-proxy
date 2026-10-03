<p align="center">
  <img src="docs/assets/og-image.png" alt="Tor MCP Proxy — web access through Tor for AI agents via MCP" width="720">
</p>

**English** · [Español](README.md)

# Tor MCP Proxy — Web access through Tor for AI agents via MCP

> **Give your AI agent the web without giving away your IP.**
> An open-source MCP server that lets Claude Code, Claude Desktop, Cursor, OpenCode and any [Model Context Protocol](https://modelcontextprotocol.io) client browse **through Tor**, including `.onion` services. Every call gets its own circuit, DNS never leaks, and blocked exit nodes are retried automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-stdio-green)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-22.19+-5FA04E?logo=nodedotjs&logoColor=white)](package.json)
[![CI](https://github.com/GermaniU/tor-mcp-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/GermaniU/tor-mcp-proxy/actions/workflows/ci.yml)
[![Tor](https://img.shields.io/badge/Network-Tor%20SOCKS5-7D4698?logo=torproject&logoColor=white)](https://www.torproject.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Tags:** `mcp-server` · `tor` · `onion` · `privacy` · `socks5` · `ai-agents` · `claude-code` · `cursor` · `opencode` · `web-scraping` · `self-hosted`

---

## 💡 Why it exists

AI agents browse with **your IP**. Every site they query learns who you are, and many sites block or rate-limit automated requests. **Tor MCP Proxy** fixes this with three simple ideas:

1. **Your IP never leaves your machine.** All traffic, DNS included, goes through Tor. There is no direct fallback route.
2. **A fresh circuit for every call.** Each tool call uses its own SOCKS identity, so Tor gives it its own exit node and calls can't be linked to each other. If an exit node is blocked, the call is retried on another one.
3. **`.onion` access with no extra setup.** It works with v3 hidden services, including ones that use self-signed certificates.

---

## ⚡ Quickstart (3 commands)

```bash
brew install tor && brew services start tor     # or: sudo apt install tor
git clone https://github.com/GermaniU/tor-mcp-proxy.git && cd tor-mcp-proxy && npm ci
claude mcp add tor-proxy --scope user -- node "$PWD/index.js"
```

You need **Node.js 22.19+** and Tor listening on `127.0.0.1:9050`. For other clients, see [`docs/CLIENTS.md`](docs/CLIENTS.md). For other operating systems, see [`docs/INSTALL.md`](docs/INSTALL.md).

### 🔍 Diagnostics

This command checks that Node.js is recent enough, that Tor is listening, that traffic **really** goes through Tor, and that each call gets its own circuit:

```bash
npm run doctor
```

The output is in Spanish.

---

## 🛠 Exposed MCP tools

| Tool | Network | What it does |
|---|---|---|
| `fetch_page` | Tor | Fetches an HTTP(S) or `.onion` page and returns its text or raw HTML. Supports GET, POST, PUT and PATCH, and sessions via `session_id` (same circuit and cookies). |
| `check_exit_ip` | Tor | Shows the IP that sites see, which is the exit node's IP. |
| `search_onion` | Tor | Searches DuckDuckGo through its `.onion` service, so the search never leaves Tor. |
| `download_file` | Tor | Saves a document, image or archive into the download directory. Never overwrites a file. |
| `extract_links` | — | Lists the links in some HTML. By default it returns only `.onion` links. |
| `page_metadata` | — | Summarises some HTML: title, headings, links, forms and meta tags. |

Each tool's parameters and usage examples are in [`docs/CLIENTS.md`](docs/CLIENTS.md#referencia-de-tools). That page is written in Spanish, but the tables are easy to follow.

---

## 🎯 Current scope

Tor MCP Proxy is deliberately small. It does **one thing well: fetch web content through Tor for an agent**. It is not a browser or a crawler.

### What it DOES
- ✅ Sends every request, DNS included, through Tor.
- ✅ Uses an independent circuit per call, and retries on a new exit node after a 403, 429 or 5xx response.
- ✅ Reaches `.onion` v3 services, including those with self-signed HTTPS certificates.
- ✅ Keeps domain-scoped cookie sessions for logins and forms.
- ✅ Saves downloads into a sandboxed directory.
- ✅ Blocks SSRF and enforces size limits on every response.

### What it does NOT do (yet)
- ❌ **It does not run JavaScript.** Pages that are rendered in the browser return little text.
- ❌ **It is not Tor Browser.** The User-Agent matches Tor Browser, but the TLS fingerprint is Node's. See [`SECURITY.md`](SECURITY.md).
- ❌ **It cannot pick the exit country.** Tor chooses exit nodes at random.
- ❌ **It is not fast.** Expect 2–10 s per request.
- ❌ **It does not solve CAPTCHAs** or bypass deliberate blocks.

If you need something from the NOT list, open an [issue](https://github.com/GermaniU/tor-mcp-proxy/issues) that describes a real use case.

---

## 🔌 Connect your client

Ready-to-copy configs are in [`docs/CLIENTS.md`](docs/CLIENTS.md):

- 🟦 **Claude Code**: `claude mcp add tor-proxy --scope user -- node /path/to/tor-mcp-proxy/index.js`
- 🟫 **Claude Desktop**: `claude_desktop_config.json`
- 🟧 **Cursor**: Settings → MCP Servers
- 🟪 **OpenCode**: `opencode.json`

JSON snippets are in [`examples/`](examples/).

---

## ⚙️ Configuration

Every setting is an optional environment variable. These are the most common ones:

| Variable | Default | Purpose |
|---|---|---|
| `TOR_SOCKS5` | `socks5://127.0.0.1:9050` | Address of the Tor SOCKS5 proxy. |
| `TOR_DOWNLOAD_DIR` | `~/Downloads/tor-mcp-proxy` | The only directory `download_file` writes to. |
| `TOR_MAX_RETRIES` | `3` | How many extra attempts to make, each on a new circuit. |
| `TOR_LOG_PATH` | *(off)* | JSONL audit log. ⚠️ It records URLs and search queries. |

The full list is in [`docs/INSTALL.md`](docs/INSTALL.md#variables-de-entorno).

---

## 🧪 Smoke test against real Tor

```bash
npm run smoke
```

This command starts the server over stdio, the way an MCP client would, and runs these tools against the live network:
- `check_exit_ip`
- `fetch_page` on check.torproject.org and on DuckDuckGo's `.onion` site
- `search_onion`

---

## 🧱 Architecture (vertical slice)

```
┌─ your agent (Claude Code / Cursor / OpenCode / …) ─┐
│           │ MCP stdio                              │
└───────────┼────────────────────────────────────────┘
            ▼
   ┌──────────────────┐   lib/features/<tool>/   ← one folder per tool
   │  tor-mcp-proxy   │   lib/shared/            ← network, HTML, MCP (no global state)
   │    (Node.js)     │   lib/app/               ← config + dependency injection
   └────────┬─────────┘
            │ SOCKS5 (one circuit per call)
            ▼
   ┌──────────────────┐        ┌───────────┐
   │   Tor (local)    │ ─────▶ │ exit node │ ─────▶ website / .onion
   └──────────────────┘        └───────────┘
```

Each tool lives in its own folder, `lib/features/<tool>/`. Adding a tool means adding a folder and one line in `lib/features/index.js`. An architecture test stops the layers from mixing.

Technical details are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 🔒 Security and privacy

- **No DNS leaks.** Tor resolves every hostname; your local resolver never sees them.
- **Domain-scoped cookies** in sessions, handled by `tough-cookie` with the Public Suffix List.
- **Redirects can't leave `.onion` space** for clearnet.
- **Sandboxed downloads.** Files are written only inside `TOR_DOWNLOAD_DIR`. Existing files are never overwritten, and `..` paths, hidden files and symlinks are rejected.
- **SSRF guard.** Private, loopback and cloud-metadata IPs are rejected.

The full threat model, including what this proxy does **not** protect against, is in [`SECURITY.md`](SECURITY.md). Report vulnerabilities privately from the repository's Security tab.

---

## 🤝 Contributing

Tor MCP Proxy is MIT licensed, no strings attached. PRs, issues and forks are welcome.

**Rules (summary):**
1. **Privacy first.** Any change that sends traffic or DNS outside Tor will not be accepted.
2. **Clean Code · SOLID · KISS · YAGNI · Vertical slice · Tests first.** PRs without tests are not merged.
3. **English identifiers, Spanish commits** (English is accepted too), using Conventional Commits.
4. **A new tool means a new folder.** Don't touch existing slices except to fix bugs.
5. **DIP.** Features use `context.web` and never import `undici`. `test/architecture.test.js` checks this.

The full guide is in [`CONTRIBUTING.md`](CONTRIBUTING.md).

```bash
# Local development setup (no Tor needed)
npm ci
npm run lint       # ESLint
npm run check      # syntax check of every file
npm test           # unit + integration + MCP protocol tests, ~2 s, offline
```

---

## 🩹 Troubleshooting

**`Could not connect to the Tor SOCKS5 proxy`**
- Tor is not running, or it listens on another port. Run `npm run doctor`. Tor Browser uses port `9150`: set `TOR_SOCKS5=socks5://127.0.0.1:9150`.

**`HTTP 403 … (still failing after 4 attempts on independent Tor circuits)`**
- The site blocks every Tor exit node. This is not a bug; many sites do it. Look for the same content elsewhere, or on the site's `.onion` version.

**`Request timed out`**
- The Tor network is slow, or the circuit is bad. Retry, or raise `TOR_REQUEST_TIMEOUT_MS` (up to 120000).

**The page returns very little text**
- The page is probably rendered with JavaScript in the browser. Try `raw: true` to see the actual HTML, or look for a version of the site that works without JavaScript.

**`download_file` says `A file already exists`**
- This is intentional: files are never overwritten. Use a different `output_path`.

---

## 📚 Documentation

Most of these documents are written in Spanish.

- [`docs/INSTALL.md`](docs/INSTALL.md): detailed installation, every variable, and more troubleshooting.
- [`docs/CLIENTS.md`](docs/CLIENTS.md): per-client configuration and the tool reference.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): technical decisions and the reasons behind them.
- [`SECURITY.md`](SECURITY.md): threat model and how to report a vulnerability.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): disciplines, workflow, and how to add a tool.
- [`CHANGELOG.md`](CHANGELOG.md): release history.

---

## 📄 License

[MIT](LICENSE). Based on [DataImpulse-MCP](https://github.com/Gentleman-Programming/dataimpulse-mcp) (MIT) by Gentleman Programming.

---

**Made by [@GermaniU](https://github.com/GermaniU)**. If it helped you, a ⭐ helps others find it. If something breaks, open an issue and we'll fix it.
