// Shared test helpers: a local HTTP server and a "circuit" that talks to it
// directly (no Tor), so request logic can be tested offline.
import { createServer } from "node:http";

export const directCircuit = {
  dispatcherFor: () => undefined, // undefined = undici's global dispatcher
  close: async () => {}
};

// Accepts any URL (the real guard would reject localhost).
export const allowAll = async (value) => new URL(value);

export async function startServer(handler) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    request.bodyText = Buffer.concat(chunks).toString("utf8");
    handler(request, response);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    port,
    url: (path, host = "127.0.0.1") => `http://${host}:${port}${path}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      })
  };
}

export function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(payload));
}

export function redirect(response, status, location, headers = {}) {
  response.writeHead(status, { location, ...headers });
  response.end();
}

// A full feature context (same wiring as production) whose circuits skip Tor
// and whose destination check allows the local test server.
export async function createTestContext({ downloadsDirectory, env = {} } = {}) {
  const { loadConfig } = await import("../lib/app/config.js");
  const { createContext } = await import("../lib/app/server.js");
  const config = loadConfig({ TOR_MAX_RETRIES: "2", ...env });

  let circuits = 0;
  const newCircuit = () => ({ ...directCircuit, identity: `test-${(circuits += 1)}` });

  const context = createContext(
    { ...config, retryBackoffMs: 0 },
    {
      newCircuit,
      validate: allowAll,
      auditLog: () => {},
      ...(downloadsDirectory && { downloads: { directory: downloadsDirectory, maxBytes: 1_024 } })
    }
  );
  return { context, circuitsCreated: () => circuits };
}
