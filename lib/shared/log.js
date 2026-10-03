// Opt-in JSONL audit log: one line per tool call. Never logs request bodies,
// cookies or session ids.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Returns `log(entry)`. With an empty path, logging is a no-op.
export function createAuditLog(logPath) {
  if (!logPath) {
    return () => {};
  }

  return (entry) => {
    try {
      const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n";
      mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
      // 0600: the log contains visited URLs and search queries.
      appendFileSync(logPath, line, { encoding: "utf8", mode: 0o600 });
    } catch {
      // Logging is best-effort — never break a tool call because of it.
    }
  };
}
