# Security and privacy

This page explains what `tor-mcp-proxy` protects against, what it does not protect against, and how to report a vulnerability.

## Threat model

### What it protects

| Risk | How it is handled |
|---|---|
| Sites learn your real IP address | All traffic goes through the Tor SOCKS5 proxy. There is no direct fallback. |
| Your ISP or DNS resolver learns which sites you visit | Hostnames are passed to Tor unresolved, and no local DNS lookups are made by default (`TOR_LOCAL_DNS_CHECK=false`). |
| Different tool calls get linked through a shared circuit | Each call uses a random SOCKS identity. Tor's `IsolateSOCKSAuth` (on by default) then gives it its own circuit. |
| Cookies from one site reach another site | In sessions, cookies are stored per domain and path with [tough-cookie](https://github.com/salesforce/tough-cookie), following RFC 6265 and the Public Suffix List. |
| A `.onion` site redirects you to a clearnet site | Redirects from `.onion` to a clearnet host are blocked at every hop. |
| SSRF: the AI is tricked into requesting your LAN or cloud metadata | Literal private, loopback, link-local and metadata IPs and local hostnames are rejected. Through Tor, hostnames are resolved by the exit relay, and Tor refuses connections to internal addresses. |
| Downloads overwrite your files or plant code | Files are written only inside `TOR_DOWNLOAD_DIR`. Existing files are never overwritten. Paths containing `..`, hidden files, absolute paths and symlink escapes are refused. Executables, HTML and SVG are rejected. |
| Huge responses exhaust memory | Bodies are streamed and aborted once they pass the configured limit. |

### What it does NOT protect

- **Anything you put in a request.** If the AI logs in with your real account or submits personal data, Tor cannot hide that.
- **Browser fingerprinting.** The User-Agent matches Tor Browser, but the TLS and HTTP fingerprints are Node's. A site that looks closely can tell the request does not come from Tor Browser. That narrows the anonymity set, although it does not reveal your IP.
- **Linking inside a session.** A `session_id` reuses one circuit and one cookie jar on purpose. Requests that share a session are linkable.
- **Exit node snooping on plain HTTP.** The exit relay can read and modify unencrypted clearnet traffic. `.onion` and HTTPS traffic are end-to-end encrypted.
- **A compromised machine or MCP client.** The server trusts whatever your MCP client sends it.
- **Content risk.** Pages are returned to the AI as text. Treat them as untrusted input, since they may contain prompt-injection attempts.

### `.onion` and TLS

`.onion` addresses authenticate the server cryptographically, so HTTPS certificates for `.onion` hosts are **not** verified. Many hidden services use self-signed certificates. This relaxed TLS setting applies only to `.onion` hosts, through a separate dispatcher. Clearnet HTTPS always uses strict certificate verification.

## Settings that weaken privacy

| Setting | Effect |
|---|---|
| `TOR_LOCAL_DNS_CHECK=true` | Each hostname is resolved by your local DNS resolver, so it is leaked. |
| `TOR_ROTATE_IDENTITY=false` | All calls share Tor's current circuit and become linkable. |
| `TOR_LOG_PATH=...` | Visited URLs and search queries are written to disk (file mode `0600`). |
| `TOR_USER_AGENT=...` | A User-Agent other than Tor Browser's makes you stand out among Tor users. |

## Recommended Tor setup

The default `tor` package settings work. For extra safety, add these lines to your `torrc`:

```
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
ClientRejectInternalAddresses 1
```

Both are already Tor's defaults; setting them explicitly guards against a changed config.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting instead: open the **Security** tab of the repository and choose **Report a vulnerability**. Include the steps to reproduce the problem and its impact.
