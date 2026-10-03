// HTML -> plain text. A tolerant, linear-time "good enough" converter for LLM
// consumption, not a spec-compliant HTML parser.

// Converts HTML to readable plain text: drops tags, comments, <script> and
// <style>; inserts line breaks at block-level elements; decodes entities.
export function htmlToText(html) {
  const lowercaseHtml = html.toLowerCase();
  let output = "";
  let cursor = 0;

  while (cursor < html.length) {
    if (html.startsWith("<!--", cursor)) {
      const end = html.indexOf("-->", cursor + 4);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }

    if (html[cursor] !== "<") {
      const next = html.indexOf("<", cursor);
      const end = next === -1 ? html.length : next;
      output += html.slice(cursor, end);
      cursor = end;
      continue;
    }

    const end = findTagEnd(html, cursor + 1);
    if (end === -1) {
      // No tag end anywhere after this point: the rest is text. Stopping here
      // (instead of retrying from the next "<") keeps the scan linear.
      output += html.slice(cursor);
      break;
    }

    const token = html.slice(cursor + 1, end);
    const tagName = getTagName(token);
    const isClosingTag = /^\s*\//.test(token);

    if (!tagName) {
      cursor = end + 1;
      continue;
    }

    if (!isClosingTag && (tagName === "script" || tagName === "style")) {
      cursor = skipElement(html, lowercaseHtml, end + 1, tagName);
      continue;
    }

    if (isTextBoundaryTag(tagName)) {
      output += "\n";
    }

    cursor = end + 1;
  }

  return decodeHtmlEntities(output)
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+\n/g, "\n")
    .replace(/\n[ \t\f\v]+/g, "\n")
    .replace(/[ \t\f\v]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Collapses an HTML fragment (e.g. the inside of an <a> or <h1>) to one line.
export function inlineText(fragment) {
  return htmlToText(fragment).replace(/\s+/g, " ").trim();
}

// Index of the ">" that closes a tag starting at `start`, skipping quoted
// attribute values; -1 if there is none.
export function findTagEnd(html, start) {
  let quote = "";

  for (let index = start; index < html.length; index += 1) {
    const character = html[index];

    if (quote) {
      if (character === quote) quote = "";
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }

  return -1;
}

function getTagName(token) {
  const match = token.match(/^\s*\/?\s*([A-Za-z][A-Za-z0-9:-]*)\b/);
  return match?.[1]?.toLowerCase();
}

function skipElement(html, lowercaseHtml, start, tagName) {
  let closingTag = lowercaseHtml.indexOf(`</${tagName}`, start);

  while (closingTag !== -1) {
    const end = findTagEnd(html, closingTag + 2);
    if (end === -1) {
      return html.length;
    }

    const token = html.slice(closingTag + 1, end);
    if (/^\s*\/\s*/.test(token) && getTagName(token) === tagName) {
      return end + 1;
    }

    closingTag = lowercaseHtml.indexOf(`</${tagName}`, end + 1);
  }

  return html.length;
}

const TEXT_BOUNDARY_TAGS = new Set(
  "address article aside blockquote br caption div dl dt dd fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table td th tr ul".split(
    " "
  )
);

function isTextBoundaryTag(tagName) {
  return TEXT_BOUNDARY_TAGS.has(tagName);
}

const NAMED_ENTITIES = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };

export function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code) => {
    const normalized = code.toLowerCase();

    if (normalized in NAMED_ENTITIES) {
      return NAMED_ENTITIES[normalized];
    }

    const numericValue = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);

    try {
      return String.fromCodePoint(numericValue);
    } catch {
      return entity;
    }
  });
}
