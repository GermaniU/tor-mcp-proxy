#!/usr/bin/env node
// tor-mcp-proxy entry point: an MCP server over stdio whose tools reach the
// web exclusively through a Tor SOCKS5 proxy. See README.md and
// docs/ARCHITECTURE.md for how the pieces fit together.
import { runtimeTrustProblems } from "./lib/shared/net/trust.js";

// Refuse to start on a runtime that a malicious Tor exit could fool with a
// forged certificate (see lib/shared/net/trust.js). This runs before the MCP
// SDK is even loaded, so stdout stays clean: the reason goes to stderr and the
// MCP client sees the process exit non-zero instead of a half-working server.
// process.exitCode (not process.exit) lets stderr flush on async pipes (macOS).
const problems = runtimeTrustProblems();
if (problems.length > 0) {
  console.error(`tor-mcp-proxy: refusing to start: ${problems.join("; ")}. Run \`npm run doctor\` for details.`);
  process.exitCode = 1;
} else {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createServer } = await import("./lib/app/server.js");
  await createServer().connect(new StdioServerTransport());
}
