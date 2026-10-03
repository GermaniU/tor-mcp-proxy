// download_file — save a document/image/archive into the download directory.
import { relative } from "node:path";
import { z } from "zod";
import { cancelBody } from "../../shared/net/http.js";
import { isBlockedStatus } from "../../shared/net/tor.js";
import { httpUrl } from "../../shared/mcp/schema-types.js";
import { errorFailure, failure, statusFailure, success } from "../../shared/mcp/results.js";
import { isAllowedDownloadType, resolveDownloadPath, writeDownload } from "./storage.js";

const inputShape = {
  url: httpUrl.describe("HTTP(S) or .onion URL of the file"),
  output_path: z.string().trim().min(1).max(512).describe("Relative path inside the download directory, e.g. reports/file.pdf")
};

export const downloadFileTool = {
  name: "download_file",
  definition: {
    title: "Download File",
    description:
      "Download a document, image, archive or data file through Tor into the server's download directory " +
      "(TOR_DOWNLOAD_DIR). output_path is relative to that directory; existing files are never overwritten.",
    inputSchema: inputShape
  },
  schema: z.object(inputShape).strict(),
  logFields: (input) => ({ url: input.url, output_path: input.output_path }),
  handler: downloadFile
};

export async function downloadFile({ url, output_path }, { web, downloads }) {
  const { directory, maxBytes } = downloads;
  const target = resolveDownloadPath(output_path, directory);
  if (!target) {
    return failure(
      "Invalid output_path: use a relative path like 'folder/file.pdf'. Each part must start with a letter, digit or " +
        "underscore and contain only letters, digits, '.', '_', '-' or spaces (no '..', no absolute paths, no hidden files)."
    );
  }

  let destination;
  try {
    destination = await web.assertAllowed(url);
  } catch (error) {
    return errorFailure(error);
  }

  return web.run(async (circuit) => {
    const { response } = await web.fetch(circuit, destination, { headers: { accept: "*/*" } });

    // Check status first: a block page (HTML 403) must be retried, not
    // reported as a disallowed content type.
    if (!response.ok) {
      await cancelBody(response.body);
      return { done: !isBlockedStatus(response.status), result: statusFailure(response.status) };
    }

    const contentType = response.headers.get("content-type");
    if (!isAllowedDownloadType(contentType)) {
      await cancelBody(response.body);
      return {
        done: true,
        result: failure(`Content type "${contentType}" is not allowed. Only documents, images, archives and data files can be downloaded.`)
      };
    }

    const bytes = await web.readBytes(response, maxBytes);
    await writeDownload(target, bytes, directory);

    return {
      done: true,
      result: success(`Downloaded ${bytes.byteLength.toLocaleString("en-US")} bytes to ${relative(directory, target)} (in ${directory})`)
    };
  });
}
