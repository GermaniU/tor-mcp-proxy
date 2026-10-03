import { z } from "zod";
import { httpUrl } from "../../shared/mcp/schema-types.js";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH"];
export const BODY_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "application/json",
  "text/plain",
  "multipart/form-data"
];

export const inputShape = {
  url: httpUrl.describe("HTTP(S) or .onion URL to fetch"),
  raw: z.boolean().optional().describe("Return raw HTML instead of extracted text (default false)"),
  method: z.enum(HTTP_METHODS).optional().describe("HTTP method (default GET)"),
  body: z.string().max(1_048_576).optional().describe("Request body; required for POST/PUT/PATCH"),
  content_type: z.string().max(200).optional().describe("Body content type; required for POST/PUT/PATCH"),
  session_id: z.string().trim().min(1).max(128).optional().describe("Reuse the same Tor circuit and cookies across calls")
};

export function isAllowedBodyContentType(contentType) {
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  return BODY_CONTENT_TYPES.includes(mediaType);
}

export const inputSchema = z
  .object(inputShape)
  .strict()
  .superRefine((input, ctx) => {
    const method = input.method ?? "GET";
    if (method === "GET") {
      if (input.body !== undefined) {
        ctx.addIssue({ code: "custom", path: ["body"], message: "GET requests cannot have a body" });
      }
      return;
    }

    if (input.body === undefined) {
      ctx.addIssue({ code: "custom", path: ["body"], message: `${method} requires a body` });
    }
    if (!input.content_type) {
      ctx.addIssue({ code: "custom", path: ["content_type"], message: `${method} requires a content_type` });
    } else if (!isAllowedBodyContentType(input.content_type)) {
      ctx.addIssue({ code: "custom", path: ["content_type"], message: `must be one of: ${BODY_CONTENT_TYPES.join(", ")}` });
    }
  });
