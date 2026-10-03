import assert from "node:assert/strict";
import test from "node:test";
import { extractLinksFromHtml } from "../../lib/features/extract-links/extract.js";
import { extractPageMetadata } from "../../lib/features/page-metadata/metadata.js";
import { parseDuckDuckGoResults, unwrapDuckDuckGoUrl } from "../../lib/features/search-onion/parse-results.js";

const ONION = "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion";

test("extract_links keeps only .onion links by default", () => {
  const html = `<a href="http://${ONION}/a">Onion</a><a href="https://example.com">Clear</a>`;
  assert.deepEqual(extractLinksFromHtml(html), [{ url: `http://${ONION}/a`, title: "Onion" }]);
});

test("extract_links dedupes, drops non-http links and resolves relative ones with base_url", () => {
  const html = [
    `<a href="https://example.com/?a=1&amp;b=2"><b>Bold</b> link</a>`,
    `<a href='https://example.com/?a=1&amp;b=2'>Duplicate</a>`,
    `<a href="javascript:alert(1)">JS</a>`,
    `<a href="/about">About</a>`
  ].join("");
  assert.deepEqual(extractLinksFromHtml(html, { onionOnly: false }), [{ url: "https://example.com/?a=1&b=2", title: "Bold link" }]);
  assert.deepEqual(extractLinksFromHtml(html, { onionOnly: false, baseUrl: "https://example.com/x/" }), [
    { url: "https://example.com/?a=1&b=2", title: "Bold link" },
    { url: "https://example.com/about", title: "About" }
  ]);
});

test("page_metadata returns structured page facts", () => {
  const html = `<html><head><title>My &amp; Page</title>
    <meta name="description" content="A test page">
    <meta property="og:title" content="OG title"></head>
    <body><h1>Main <em>heading</em></h1><h2>Sub</h2>
    <a href="/local">L</a><a href="https://example.com/x">same</a><a href="https://other.org">ext</a>
    <a href="http://${ONION}/">onion</a><form></form><form></form></body></html>`;
  const metadata = extractPageMetadata(html, "https://example.com/");

  assert.equal(metadata.title, "My & Page");
  assert.equal(metadata.description, "A test page");
  assert.deepEqual(metadata.headings.h1, ["Main heading"]);
  assert.deepEqual(metadata.headings.h2, ["Sub"]);
  assert.deepEqual(metadata.links, { internal: 2, external: 1, onion: 1 });
  assert.equal(metadata.forms, 2);
  assert.deepEqual(metadata.meta_tags.map((tag) => tag.name), ["description", "og:title"]);
});

test("search_onion parser unwraps DuckDuckGo redirect links and reads snippets", () => {
  const target = `http://${ONION}/page`;
  const html = `
    <div class="result"><h2 class="result__title"><a rel="nofollow" class="result__a"
      href="//duckduckgo.com/l/?uddg=${encodeURIComponent(target)}&amp;rut=abc">First <b>result</b></a></h2>
      <a class="result__snippet" href="#">Snippet &amp; more</a></div>
    <div class="result"><h2 class="result__title"><a class="result__a" href="https://example.com/">Second</a></h2></div>`;

  assert.deepEqual(parseDuckDuckGoResults(html), [
    { url: target, title: "First result", description: "Snippet & more" },
    { url: "https://example.com/", title: "Second", description: "" }
  ]);
  assert.equal(parseDuckDuckGoResults("<html>nothing</html>").length, 0);
  assert.equal(unwrapDuckDuckGoUrl("https://example.com/a"), "https://example.com/a");
});
