// Linear-time element scanner shared by the HTML features.
//
// Regexes like /<a[^>]*>([\s\S]*?)<\/a>/ go quadratic on malformed input
// (thousands of unclosed tags), which a hostile page can trigger. This
// scanner visits every character a constant number of times instead.
import { findTagEnd, decodeHtmlEntities, inlineText } from "./text.js";

// Yields { attributes, inner } for each <tagName ...> element. An element
// without a closing tag ends where the next element of the same name begins.
export function* elements(html, tagName) {
  const lower = html.toLowerCase();
  const open = `<${tagName.toLowerCase()}`;
  const close = `</${tagName.toLowerCase()}`;
  let nextClose = -1; // cached: first closing tag at or after the current element
  let cursor = 0;

  while (true) {
    const start = lower.indexOf(open, cursor);
    if (start === -1) return;

    // Make sure "<a" isn't the start of "<abbr".
    const following = lower[start + open.length];
    if (following !== undefined && !/[\s>/]/.test(following)) {
      cursor = start + 1;
      continue;
    }

    const tagEnd = findTagEnd(html, start + open.length);
    if (tagEnd === -1) return;

    if (nextClose !== Infinity && nextClose < tagEnd) {
      const found = lower.indexOf(close, tagEnd);
      nextClose = found === -1 ? Infinity : found;
    }

    const nextOpen = nextElementStart(lower, open, tagEnd + 1);
    const innerEnd = Math.min(nextClose, nextOpen, html.length);

    yield {
      attributes: html.slice(start + open.length, tagEnd),
      inner: html.slice(tagEnd + 1, innerEnd)
    };

    cursor = tagEnd + 1;
  }
}

function nextElementStart(lower, open, from) {
  let index = lower.indexOf(open, from);
  while (index !== -1) {
    const following = lower[index + open.length];
    if (following === undefined || /[\s>/]/.test(following)) return index;
    index = lower.indexOf(open, index + 1);
  }
  return Infinity;
}

// Value of an attribute (quoted or unquoted), entity-decoded; null if absent.
export function attribute(attributes, name) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  return match ? decodeHtmlEntities((match[1] ?? match[2] ?? match[3]).trim()) : null;
}

// Yields { href, text } for every <a href> in the document, in order.
export function* anchors(html) {
  for (const { attributes, inner } of elements(html, "a")) {
    const href = attribute(attributes, "href");
    if (href !== null) {
      yield { href, text: inlineText(inner).slice(0, 200) };
    }
  }
}

export function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl);
  } catch {
    return null;
  }
}
