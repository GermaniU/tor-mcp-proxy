// fetch_page — fetch a page through Tor and return text or raw HTML.
import { htmlToText } from "../../shared/html/text.js";
import { cancelBody, isTextualContentType } from "../../shared/net/http.js";
import { isBlockedStatus } from "../../shared/net/tor.js";
import { errorFailure, failure, statusFailure, success } from "../../shared/mcp/results.js";
import { inputSchema, inputShape } from "./schema.js";

export const fetchPageTool = {
  name: "fetch_page",
  definition: {
    title: "Fetch Page",
    description:
      "Fetch an HTTP(S) or .onion page through Tor and return its text (or raw HTML). " +
      "Supports GET/POST/PUT/PATCH and sticky sessions (same circuit + cookies) via session_id.",
    inputSchema: inputShape
  },
  schema: inputSchema,
  logFields: (input) => ({ url: input.url, method: input.method ?? "GET", session: Boolean(input.session_id) }),
  handler: fetchPage
};

export async function fetchPage({ url, raw = false, method = "GET", body, content_type, session_id }, { web, sessions }) {
  let destination;
  try {
    destination = await web.assertAllowed(url);
  } catch (error) {
    return errorFailure(error);
  }

  const session = session_id ? sessions.getOrCreate(session_id) : null;
  const headers = content_type ? { "content-type": content_type } : {};

  return web.run(
    async (circuit) => {
      const { response } = await web.fetch(circuit, destination, { method, headers, body, cookieJar: session?.cookies });

      const contentType = response.headers.get("content-type");
      if (!isTextualContentType(contentType)) {
        await cancelBody(response.body);
        return {
          done: true,
          result: failure(`The destination returned a non-text content type (${contentType}). Use download_file for binary files.`)
        };
      }

      const text = await web.readText(response);

      if (!response.ok) {
        return { done: !isBlockedStatus(response.status), result: statusFailure(response.status) };
      }

      return { done: true, result: success(raw ? text : htmlToText(text)) };
    },
    { session }
  );
}
