// `npm run check`: syntax-checks every JavaScript file in the project
// (fast, no network, no Tor needed).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const roots = ["index.js", "lib", "scripts", "test"];

function* jsFiles(path) {
  if (path.endsWith(".js")) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) yield* jsFiles(child);
    else if (entry.name.endsWith(".js")) yield child;
  }
}

let failed = false;
for (const root of roots) {
  for (const file of jsFiles(root)) {
    const { status } = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (status !== 0) failed = true;
  }
}

process.exit(failed ? 1 : 0);
