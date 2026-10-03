---
name: Bug report
about: Something is broken or behaving unexpectedly
title: "fix: <short description>"
labels: bug
assignees: ""
---

<!-- Security problem? Do NOT open a public issue. See SECURITY.md. -->

## Version

<!-- `npm pkg get version` in your checkout, or the git commit -->

## Environment

- Node.js version (`node -v`):
- OS:
- MCP client (Claude Code, Claude Desktop, OpenCode, …):
- Tor version (`tor --version`):

## Configuration

<!-- Any TOR_* variables you set. Do not paste URLs or queries you consider private. -->

```
TOR_SOCKS5=
```

## Steps to reproduce

1.
2.
3.

## Expected behavior

## Actual behavior

<!-- Include the full tool error text. -->

## Tor check

```
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip
```

<!-- Paste the response here -->

---

> Issues in Spanish are welcome too. / Los issues en español también son bienvenidos.
