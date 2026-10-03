import { isOnionHostname } from "../../shared/net/destination.js";
import { anchors, attribute, elements, resolveUrl } from "../../shared/html/elements.js";
import { inlineText } from "../../shared/html/text.js";

const first = (iterator) => iterator.next().value;

export function extractPageMetadata(html, url) {
  const baseUrl = url ? resolveUrl(url) : null;
  const metadata = {
    url: url || "(unknown)",
    title: "",
    description: "",
    headings: { h1: [], h2: [], h3: [] },
    links: { internal: 0, external: 0, onion: 0 },
    forms: 0,
    meta_tags: []
  };

  const title = first(elements(html, "title"));
  if (title) {
    metadata.title = inlineText(title.inner).slice(0, 500);
  }

  for (const level of ["h1", "h2", "h3"]) {
    for (const { inner } of elements(html, level)) {
      metadata.headings[level].push(inlineText(inner).slice(0, 200));
    }
  }

  for (const { href } of anchors(html)) {
    const linkUrl = resolveUrl(href, baseUrl ?? undefined);
    if (!linkUrl) {
      // Relative link without a base URL: it necessarily points to the same site.
      metadata.links.internal += 1;
    } else if (isOnionHostname(linkUrl.hostname)) {
      metadata.links.onion += 1;
    } else if (baseUrl && linkUrl.hostname === baseUrl.hostname) {
      metadata.links.internal += 1;
    } else {
      metadata.links.external += 1;
    }
  }

  metadata.forms = [...elements(html, "form")].length;

  for (const { attributes } of elements(html, "meta")) {
    const name = attribute(attributes, "name") ?? attribute(attributes, "property");
    const content = attribute(attributes, "content");
    if (!name || content === null) continue;

    metadata.meta_tags.push({ name, content: content.slice(0, 200) });
    if (name.toLowerCase() === "description" && !metadata.description) {
      metadata.description = content.slice(0, 500);
    }
  }

  return metadata;
}
