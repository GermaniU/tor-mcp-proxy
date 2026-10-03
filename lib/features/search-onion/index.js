// search_onion — web search through DuckDuckGo's onion service.
import { z } from "zod";
import { isBlockedStatus } from "../../shared/net/tor.js";
import { statusFailure, success } from "../../shared/mcp/results.js";
import { parseDuckDuckGoResults } from "./parse-results.js";

// DuckDuckGo's official onion service. Unlike clearnet engines (Ahmia,
// duckduckgo.com) it doesn't block Tor exit nodes, and traffic never leaves Tor.
export const DDG_ONION_SEARCH_URL = "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/html/";

const inputShape = {
  query: z.string().trim().min(1).max(500).describe("Search query"),
  limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 20)")
};

export const searchOnionTool = {
  name: "search_onion",
  definition: {
    title: "Search via DuckDuckGo onion",
    description:
      "Search the web through DuckDuckGo's .onion service, entirely inside Tor. " +
      "Returns titles, URLs and snippets; results may include both clearnet and .onion sites.",
    inputSchema: inputShape
  },
  schema: z.object(inputShape).strict(),
  logFields: (input) => ({ query: input.query, limit: input.limit ?? 20 }),
  handler: searchOnion
};

export async function searchOnion({ query, limit = 20 }, { web }, { endpoint = DDG_ONION_SEARCH_URL } = {}) {
  const body = new URLSearchParams({ q: query }).toString();

  return web.run(async (circuit) => {
    const { response } = await web.fetch(circuit, endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
    const html = await web.readText(response);

    if (!response.ok) {
      return { done: !isBlockedStatus(response.status), result: statusFailure(response.status) };
    }

    return { done: true, result: formatResults(parseDuckDuckGoResults(html).slice(0, limit)) };
  });
}

export function formatResults(results) {
  if (results.length === 0) {
    return success("No results found for your query.");
  }

  const formatted = results
    .map((result, index) => `${index + 1}. ${result.title}\n   ${result.url}${result.description ? `\n   ${result.description}` : ""}`)
    .join("\n\n");

  return success(`Found ${results.length} result(s) via DuckDuckGo (.onion):\n\n${formatted}`);
}
