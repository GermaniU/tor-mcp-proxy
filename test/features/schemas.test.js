import assert from "node:assert/strict";
import test from "node:test";
import { checkExitIpTool } from "../../lib/features/check-exit-ip/index.js";
import { downloadFileTool } from "../../lib/features/download-file/index.js";
import { extractLinksTool } from "../../lib/features/extract-links/index.js";
import { fetchPageTool } from "../../lib/features/fetch-page/index.js";
import { isAllowedBodyContentType } from "../../lib/features/fetch-page/schema.js";
import { searchOnionTool } from "../../lib/features/search-onion/index.js";

const ok = (tool, input) => assert.equal(tool.schema.safeParse(input).success, true, JSON.stringify(input));
const bad = (tool, input) => assert.equal(tool.schema.safeParse(input).success, false, JSON.stringify(input));

test("fetch_page: GET needs only a URL and rejects unknown fields", () => {
  ok(fetchPageTool, { url: "https://example.com" });
  ok(fetchPageTool, { url: "https://example.com", session_id: "s1", raw: true });
  bad(fetchPageTool, { url: "https://example.com", country: "us" });
  bad(fetchPageTool, { url: "not a url" });
  bad(fetchPageTool, { url: "https://example.com", body: "x" });
});

test("fetch_page: POST/PUT/PATCH need a body and an allowed content_type", () => {
  ok(fetchPageTool, { url: "https://example.com", method: "POST", body: "a=1", content_type: "application/x-www-form-urlencoded" });
  ok(fetchPageTool, { url: "https://example.com", method: "PUT", body: "", content_type: "application/json; charset=utf-8" });
  bad(fetchPageTool, { url: "https://example.com", method: "POST", content_type: "application/json" });
  bad(fetchPageTool, { url: "https://example.com", method: "POST", body: "x" });
  bad(fetchPageTool, { url: "https://example.com", method: "POST", body: "x", content_type: "application/xml" });
  bad(fetchPageTool, { url: "https://example.com", method: "DELETE" });
});

test("isAllowedBodyContentType", () => {
  for (const type of ["application/json", "TEXT/PLAIN", "multipart/form-data; boundary=x"]) {
    assert.equal(isAllowedBodyContentType(type), true, type);
  }
  for (const type of [undefined, "", "application/xml", "text/html"]) {
    assert.equal(isAllowedBodyContentType(type), false, String(type));
  }
});

test("check_exit_ip takes no input", () => {
  ok(checkExitIpTool, {});
  bad(checkExitIpTool, { country: "us" });
});

test("search_onion validates query and limit", () => {
  ok(searchOnionTool, { query: "tor", limit: 50 });
  bad(searchOnionTool, { query: "   " });
  bad(searchOnionTool, { query: "x".repeat(501) });
  bad(searchOnionTool, { query: "tor", limit: 0 });
  bad(searchOnionTool, { query: "tor", limit: 51 });
  bad(searchOnionTool, { query: "tor", engine: "google" });
});

test("download_file and extract_links reject missing or extra fields", () => {
  ok(downloadFileTool, { url: "https://example.com/a.pdf", output_path: "a.pdf" });
  bad(downloadFileTool, { url: "https://example.com/a.pdf" });
  bad(downloadFileTool, { url: "https://example.com/a.pdf", output_path: "a.pdf", overwrite: true });
  ok(extractLinksTool, { html: "<a>", base_url: "https://example.com" });
  bad(extractLinksTool, { html: "" });
});
