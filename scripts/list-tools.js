import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const child = spawn("node", [join(__dirname, "..", "index.js")], {
  stdio: ["pipe", "pipe", "inherit"]
});

child.stdin.write('{"jsonrpc":"2.0","method":"tools/list","id":1}\n');

let output = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  output += chunk;
  try {
    const line = output.trim().split(/\r?\n/).find((l) => l.trim().startsWith("{"));
    if (line) {
      const parsed = JSON.parse(line);
      if (parsed.id === 1) {
        console.log(JSON.stringify(parsed, null, 2));
        child.stdin.end();
        child.kill();
      }
    }
  } catch {
    // wait for more data
  }
});

setTimeout(() => {
  child.kill();
}, 5000);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
