import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isAllowedDownloadType, resolveDownloadPath, writeDownload } from "../../lib/features/download-file/storage.js";

const base = "/srv/downloads";

test("resolveDownloadPath keeps files inside the download directory", () => {
  assert.equal(resolveDownloadPath("report.pdf", base), "/srv/downloads/report.pdf");
  assert.equal(resolveDownloadPath("2026/q3 report v2.pdf", base), "/srv/downloads/2026/q3 report v2.pdf");
  assert.equal(resolveDownloadPath("report..v2.pdf", base), "/srv/downloads/report..v2.pdf");
});

test("resolveDownloadPath rejects traversal, absolute, hidden and odd paths", () => {
  const bad = [
    "../escape.txt",
    "a/../../escape.txt",
    "/etc/passwd",
    ".git/hooks/pre-commit",
    "a/.ssh/authorized_keys",
    "a//b.txt",
    "a/",
    "a\\b.txt",
    "file;rm -rf.txt",
    "nul\0byte",
    "a/b/c/d/e/f/g/h/i.txt"
  ];
  for (const path of bad) assert.equal(resolveDownloadPath(path, base), null, path);
});

test("isAllowedDownloadType accepts documents/images and rejects executables, HTML and SVG", () => {
  assert.equal(isAllowedDownloadType("application/pdf"), true);
  assert.equal(isAllowedDownloadType("image/png; charset=binary"), true);
  for (const type of [null, "application/x-msdownload", "application/octet-stream", "text/html", "image/svg+xml"]) {
    assert.equal(isAllowedDownloadType(type), false, String(type));
  }
});

test("writeDownload never overwrites an existing file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tor-mcp-test-"));
  const target = resolveDownloadPath("sub/file.txt", dir);

  await writeDownload(target, Buffer.from("first"), dir);
  await assert.rejects(writeDownload(target, Buffer.from("second"), dir), /already exists/);
  assert.equal(await readFile(target, "utf8"), "first");
});

test("writeDownload refuses to follow a symlink out of the download directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tor-mcp-test-"));
  const outside = await mkdtemp(join(tmpdir(), "tor-mcp-outside-"));
  await symlink(outside, join(dir, "link"));

  const target = resolveDownloadPath("link/file.txt", dir);
  await assert.rejects(writeDownload(target, Buffer.from("x"), dir), /outside the download directory/);
});
