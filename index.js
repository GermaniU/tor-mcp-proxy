#!/usr/bin/env node
// tor-mcp-proxy entry point: an MCP server over stdio whose tools reach the
// web exclusively through a Tor SOCKS5 proxy. See README.md and
// docs/ARCHITECTURE.md for how the pieces fit together.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./lib/app/server.js";

const server = createServer();
await server.connect(new StdioServerTransport());
