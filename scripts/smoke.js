// `npm run smoke`: prueba end-to-end contra Tor REAL. Levanta el servidor por
// stdio, igual que lo haría un cliente MCP, y llama a las tools de red.
// Requiere Tor corriendo; no forma parte de la CI.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ONION = "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion";

const checks = [
  ["check_exit_ip", {}, /^Exit IP: /],
  ["fetch_page", { url: "https://check.torproject.org/" }, /Congratulations|Felicidades/i],
  ["fetch_page", { url: `https://${ONION}/` }, /DuckDuckGo/i],
  ["search_onion", { query: "tor project", limit: 3 }, /result\(s\)|No results/]
];

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["index.js"], stderr: "ignore" }));

let failures = 0;
for (const [tool, args, expected] of checks) {
  const started = performance.now();
  const result = await client.callTool({ name: tool, arguments: args });
  const text = result.content[0]?.text ?? "";
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const passed = !result.isError && expected.test(text);
  if (!passed) failures += 1;
  console.log(`${passed ? "✓" : "✗"} ${tool} ${JSON.stringify(args)} (${seconds}s)`);
  if (!passed) console.log(`    ${text.slice(0, 300).replace(/\n/g, "\n    ")}`);
}

await client.close();
console.log(failures === 0 ? "\nSmoke test OK." : `\n${failures} prueba(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
