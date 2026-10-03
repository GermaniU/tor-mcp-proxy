# Contributing

Thanks for helping! Bug reports, fixes and new tools are all welcome.

## Setup

```bash
git clone https://github.com/GermaniU/tor-mcp-proxy.git
cd tor-mcp-proxy
npm ci
npm run check && npm test
```

The test suite runs **offline**. It uses a local HTTP server in place of Tor, so you don't need Tor running to develop. For a manual end-to-end check, start Tor and run `npm run list-tools`, or connect the server to your MCP client.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes how the code is organised: vertical slices in `lib/features/`, a shared kernel in `lib/shared/`, and the composition root in `lib/app/`.

## Guidelines

The short version is in [CLAUDE.md](CLAUDE.md).


- **Privacy first.** Never add a code path that sends traffic or DNS queries outside the Tor proxy, and never log request bodies, cookies or session ids. If a change weakens a guarantee in [SECURITY.md](SECURITY.md), say so in the PR and make the new behaviour opt-in.
- **Keep dependencies minimal.** Prefer Node's standard library. Add a dependency only when it replaces security-sensitive code that is hard to get right, as `tough-cookie` does.
- **Add tests with every change.** Bug fixes come with a regression test.
- **Respect the layering.** Features use `context.web` and never import undici. Code in `shared/` never reads `process.env` and never imports from `features/`. A helper used by only one tool belongs in that tool's folder.
- **Match the existing style**: ES modules, 2-space indentation, double quotes, small functions, and comments that explain *why*.
- **Write clear commit messages**, e.g. `fix: ...`, `feat: ...` or `docs: ...`.

## Pull requests

1. Fork the repository and create a branch.
2. Make sure `npm run check` and `npm test` pass.
3. Update `README.md` and `CHANGELOG.md` when behaviour or configuration changes.
4. Open the PR and describe what changed and why.

Security issues are handled privately. See [SECURITY.md](SECURITY.md#reporting-a-vulnerability).
