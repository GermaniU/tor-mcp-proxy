// extract_links — list the links in some HTML (offline).
import { z } from "zod";
import { htmlInput, httpUrl } from "../../shared/mcp/schema-types.js";
import { success } from "../../shared/mcp/results.js";
import { extractLinksFromHtml } from "./extract.js";

const inputShape = {
  html: htmlInput.describe("HTML to scan"),
  filter_onion: z.boolean().optional().describe("Only return .onion links (default true)"),
  base_url: httpUrl.optional().describe("Page URL, used to resolve relative links")
};

export const extractLinksTool = {
  name: "extract_links",
  definition: {
    title: "Extract Links",
    description:
      "Extract links from HTML (no network access). By default only .onion links are returned; set " +
      "filter_onion: false for all links. Pass base_url to resolve relative links. Results are deduplicated and grouped by host.",
    inputSchema: inputShape
  },
  schema: z.object(inputShape).strict(),
  logFields: (input) => ({ html_length: input.html.length, filter_onion: input.filter_onion ?? true }),
  handler: extractLinks
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export async function extractLinks({ html, filter_onion = true, base_url }) {
  const links = extractLinksFromHtml(html, { onionOnly: filter_onion, baseUrl: base_url });

  if (links.length === 0) {
    return success(filter_onion ? "No .onion links found in the provided HTML." : "No links found in the provided HTML.");
  }

  const byHost = Map.groupBy(links, (link) => new URL(link.url).hostname);
  const formatted = [...byHost]
    .map(([host, hostLinks]) => {
      const list = hostLinks.map((link, index) => `  ${index + 1}. ${link.title || "(no text)"} — ${link.url}`).join("\n");
      return `${host} (${plural(hostLinks.length, "link")}):\n${list}`;
    })
    .join("\n\n");

  return success(`Found ${plural(links.length, "link")} across ${plural(byHost.size, "host")}:\n\n${formatted}`);
}
