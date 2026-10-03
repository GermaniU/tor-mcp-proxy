// page_metadata — summarise some HTML (offline).
import { z } from "zod";
import { htmlInput, httpUrl } from "../../shared/mcp/schema-types.js";
import { success } from "../../shared/mcp/results.js";
import { extractPageMetadata } from "./metadata.js";

const inputShape = {
  html: htmlInput.describe("HTML to analyse"),
  url: httpUrl.optional().describe("Page URL, used to classify links as internal/external")
};

export const pageMetadataTool = {
  name: "page_metadata",
  definition: {
    title: "Page Metadata",
    description:
      "Summarise HTML (no network access): title, description, headings (H1/H2/H3), link counts " +
      "(internal/external/.onion), forms and meta tags.",
    inputSchema: inputShape
  },
  schema: z.object(inputShape).strict(),
  logFields: (input) => ({ url: input.url ?? null, html_length: input.html.length }),
  handler: pageMetadata
};

export async function pageMetadata({ html, url }) {
  const metadata = extractPageMetadata(html, url);
  const { h1, h2, h3 } = metadata.headings;

  return success(
    [
      `URL: ${metadata.url}`,
      `Title: ${metadata.title || "(none)"}`,
      `Description: ${metadata.description || "(none)"}`,
      "",
      "Headings:",
      `  H1 (${h1.length}): ${h1.slice(0, 5).join(" | ") || "(none)"}`,
      `  H2 (${h2.length}): ${h2.slice(0, 10).join(" | ") || "(none)"}`,
      `  H3 (${h3.length})`,
      "",
      `Links: ${metadata.links.internal} internal, ${metadata.links.external} external, ${metadata.links.onion} .onion`,
      `Forms: ${metadata.forms}`,
      `Meta tags (${metadata.meta_tags.length}):`,
      ...metadata.meta_tags.slice(0, 20).map((tag) => `  ${tag.name}: ${tag.content}`)
    ].join("\n")
  );
}
