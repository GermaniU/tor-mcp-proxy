import { isOnionHostname } from "../../shared/net/destination.js";
import { anchors, resolveUrl } from "../../shared/html/elements.js";

// Extracts deduplicated http(s) links. Relative links are resolved against
// `baseUrl` when given (and dropped otherwise).
export function extractLinksFromHtml(html, { onionOnly = true, baseUrl } = {}) {
  const seen = new Set();
  const links = [];

  for (const { href, text } of anchors(html)) {
    const url = resolveUrl(href, baseUrl);
    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) continue;
    if (onionOnly && !isOnionHostname(url.hostname)) continue;

    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: key, title: text });
  }

  return links;
}
