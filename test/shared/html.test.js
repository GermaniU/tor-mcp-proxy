import assert from "node:assert/strict";
import test from "node:test";
import { anchors, attribute, elements } from "../../lib/shared/html/elements.js";
import { htmlToText } from "../../lib/shared/html/text.js";

test("htmlToText removes executable content, decodes entities, and preserves text boundaries", () => {
  const html =
    "<html><head><style>.x{}</style><script>alert('<p>')</script></head>" +
    "<body><h1>Title</h1><p>One &amp; two&nbsp;three</p><!-- hidden --><div>Next&#33;</div></body></html>";
  assert.equal(htmlToText(html), "Title\n\nOne & two three\n\nNext!");
});

test("htmlToText keeps text after an unterminated tag", () => {
  assert.equal(htmlToText("<p>ok</p><a href=\"x"), "ok\n<a href=\"x");
});

test("elements finds closed, unclosed and attribute-only elements", () => {
  const html = '<a href="1">one</a><abbr>no</abbr><a href="2">two<a href="3">three</a><meta name="x" content="y">';
  assert.deepEqual(
    [...elements(html, "a")].map((element) => element.inner),
    ["one", "two", "three"]
  );
  const [meta] = elements(html, "meta");
  assert.equal(attribute(meta.attributes, "content"), "y");
});

test("anchors handle nested tags, entities and quoting styles", () => {
  const html = `<a class="x" href="/a?b=1&amp;c=2"><b>Bold</b> text</a><a href=/u>U</a><a href='/s'>S</a><a name="n">none</a>`;
  assert.deepEqual([...anchors(html)], [
    { href: "/a?b=1&c=2", text: "Bold text" },
    { href: "/u", text: "U" },
    { href: "/s", text: "S" }
  ]);
});

// A hostile page must not be able to stall the server. Inputs are large
// enough that a quadratic algorithm takes many seconds; a linear one takes ms.
test("HTML scanning is linear on pathological input", () => {
  const inputs = ["<a href='x'>".repeat(100_000), "<a ".repeat(100_000), "<p>".repeat(100_000), "<x \"".repeat(50_000)];
  for (const html of inputs) {
    const start = performance.now();
    [...anchors(html)];
    [...elements(html, "h1")];
    htmlToText(html);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 1_000, `${html.slice(0, 12)}… took ${elapsed.toFixed(0)} ms`);
  }
});
