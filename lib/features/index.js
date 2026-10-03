// Every tool this server exposes. Each feature folder is a vertical slice:
// schema, handler and feature-specific helpers live together. To add a tool,
// create lib/features/<name>/index.js exporting
// { name, definition, schema, logFields, handler } and list it here.
import { checkExitIpTool } from "./check-exit-ip/index.js";
import { downloadFileTool } from "./download-file/index.js";
import { extractLinksTool } from "./extract-links/index.js";
import { fetchPageTool } from "./fetch-page/index.js";
import { pageMetadataTool } from "./page-metadata/index.js";
import { searchOnionTool } from "./search-onion/index.js";

export const tools = [fetchPageTool, checkExitIpTool, searchOnionTool, downloadFileTool, extractLinksTool, pageMetadataTool];
