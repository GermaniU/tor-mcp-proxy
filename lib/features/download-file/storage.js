// Safe file writing for download_file.
//
// Files are only ever written INSIDE the configured download directory
// (TOR_DOWNLOAD_DIR), never overwrite an existing file, and can't escape via
// "..", absolute paths, hidden files or symlinks.
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { RequestValidationError } from "../../shared/errors.js";
import { mediaTypeOf } from "../../shared/net/http.js";

const ALLOWED_DOWNLOAD_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/x-bzip2",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

export function isAllowedDownloadType(contentType) {
  return ALLOWED_DOWNLOAD_TYPES.has(mediaTypeOf(contentType));
}

// Each path segment: starts with a letter, digit or underscore (so no hidden
// files and no "." / ".."), then letters, digits, "._- " only.
const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._\- ]{0,254}$/;

// Validates a user-supplied relative path and returns its absolute location
// inside `baseDir`, or null if the path is unsafe.
export function resolveDownloadPath(rawPath, baseDir) {
  if (typeof rawPath !== "string" || rawPath.includes("\0") || rawPath.includes("\\") || isAbsolute(rawPath)) {
    return null;
  }

  const segments = rawPath.split("/");
  if (segments.length > 8 || !segments.every((segment) => SAFE_SEGMENT.test(segment))) {
    return null;
  }

  const target = join(baseDir, ...segments);
  const relativePath = relative(baseDir, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return target;
}

// Writes `bytes` to `target` (already validated by resolveDownloadPath).
// Refuses to overwrite, and re-checks the real parent directory so a symlink
// planted inside the download dir can't redirect the write elsewhere.
export async function writeDownload(target, bytes, baseDir) {
  await mkdir(baseDir, { recursive: true, mode: 0o700 });
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });

  const realBase = await realpath(baseDir);
  const realParent = await realpath(dirname(target));
  if (realParent !== realBase && !realParent.startsWith(realBase + sep)) {
    throw new RequestValidationError("The output path resolves outside the download directory.");
  }

  try {
    await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new RequestValidationError("A file already exists at that output_path. Choose a different name.");
    }
    throw error;
  }
}
