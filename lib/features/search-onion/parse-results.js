// Parser for DuckDuckGo's HTML results page.
import { anchors, attribute, elements, resolveUrl } from "../../shared/html/elements.js";
import { inlineText } from "../../shared/html/text.js";

// DuckDuckGo wraps result links as "//duckduckgo.com/l/?uddg=<encoded target>";
// unwrap them to the real URL.
export function unwrapDuckDuckGoUrl(href) {
  const url = resolveUrl(href, "https://duckduckgo.com");
  if (!url) return href;

  const target = url.pathname === "/l/" ? url.searchParams.get("uddg") : null;
  return target || url.toString();
}

const hasClass = (attributes, name) => (attribute(attributes, "class") ?? "").split(/\s+/).includes(name);

// Each result is an <h2 class="result__title"> followed (before the next
// title) by an element with class "result__snippet".
export function parseDuckDuckGoResults(html) {
  const titleStarts = [];
  const pattern = /<h2\b[^>]*\bresult__title\b/gi;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    titleStarts.push(match.index);
  }

  return titleStarts.flatMap((start, index) => {
    const block = html.slice(start, titleStarts[index + 1] ?? html.length);
    const link = anchors(block).next().value;
    if (!link) return [];

    const snippet = [...elements(block, "a"), ...elements(block, "div"), ...elements(block, "td")].find((element) =>
      hasClass(element.attributes, "result__snippet")
    );

    return [
      {
        url: unwrapDuckDuckGoUrl(link.href),
        title: link.text || "(no title)",
        description: snippet ? inlineText(snippet.inner) : ""
      }
    ];
  });
}
