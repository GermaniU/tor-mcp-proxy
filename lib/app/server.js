// Composition root: the only place that reads configuration and wires
// concrete implementations (Tor circuits, sessions, audit log) into the
// features. Everything below it receives its dependencies explicitly.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools as defaultTools } from "../features/index.js";
import { createAuditLog } from "../shared/log.js";
import { assertAllowedDestination } from "../shared/net/destination.js";
import { SessionStore } from "../shared/net/sessions.js";
import { createCircuitFactory } from "../shared/net/tor.js";
import { WebClient } from "../shared/net/web-client.js";
import { errorFailure, validationFailure } from "../shared/mcp/results.js";
import { loadConfig } from "./config.js";

// Builds the dependencies every feature handler receives as its context.
// `overrides` lets tests replace any piece (e.g. circuits that skip Tor).
export function createContext(config, overrides = {}) {
  const newCircuit = overrides.newCircuit ?? createCircuitFactory(config);

  const web =
    overrides.web ??
    new WebClient({
      newCircuit,
      userAgent: config.userAgent,
      timeoutMs: config.requestTimeoutMs,
      maxRetries: config.maxRetries,
      retryBackoffMs: config.retryBackoffMs,
      maxResponseBytes: config.maxResponseBytes,
      validate: overrides.validate ?? ((url) => assertAllowedDestination(url, { localDnsCheck: config.localDnsCheck }))
    });

  const sessions =
    overrides.sessions ??
    new SessionStore({ newCircuit, ttlMs: config.sessionTtlMs, maxSessions: config.maxSessions });

  return {
    web,
    sessions,
    downloads: overrides.downloads ?? { directory: config.downloadDir, maxBytes: config.maxDownloadBytes },
    auditLog: overrides.auditLog ?? createAuditLog(config.logPath)
  };
}

export function createServer({ config = loadConfig(), tools = defaultTools, ...overrides } = {}) {
  const server = new McpServer({ name: config.serverName, version: config.serverVersion });
  const context = createContext(config, overrides);

  for (const tool of tools) {
    server.registerTool(tool.name, tool.definition, async (input) => {
      const parsed = tool.schema.safeParse(input ?? {});
      if (!parsed.success) {
        return validationFailure(parsed.error);
      }

      context.auditLog({ tool: tool.name, ...tool.logFields(parsed.data) });

      try {
        return await tool.handler(parsed.data, context);
      } catch (error) {
        // Handlers report expected failures themselves; this is a last resort
        // so an unexpected bug never crashes the stdio server.
        return errorFailure(error);
      }
    });
  }

  return server;
}
