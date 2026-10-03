// `npm run doctor`: diagnóstico del entorno antes de conectar un cliente MCP.
// Verifica Node.js, que Tor escuche, que el tráfico realmente salga por Tor
// y que el directorio de descargas sea escribible.
import { access, constants, mkdir } from "node:fs/promises";
import { connect } from "node:net";
import { loadConfig } from "../lib/app/config.js";
import { createContext } from "../lib/app/server.js";

const config = loadConfig();
const context = createContext(config);
let failures = 0;

const ok = (message) => console.log(`  ✓ ${message}`);
const fail = (message, hint) => {
  failures += 1;
  console.log(`  ✗ ${message}${hint ? `\n    → ${hint}` : ""}`);
};
const info = (message) => console.log(`  · ${message}`);

console.log(`tor-mcp-proxy ${config.serverVersion} — doctor\n`);

console.log("Configuración");
info(`TOR_SOCKS5:           ${config.socksUrl}`);
info(`Aislamiento:          ${config.rotateIdentity ? "un circuito por llamada" : "DESACTIVADO (TOR_ROTATE_IDENTITY=false)"}`);
info(`DNS local:            ${config.localDnsCheck ? "ACTIVADO — filtra hostnames a tu resolver" : "desactivado (sin fugas de DNS)"}`);
info(`Directorio descargas: ${config.downloadDir}`);
info(`Log de auditoría:     ${config.logPath || "desactivado"}`);

console.log("\nEntorno");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 22 || (major === 22 && minor >= 19)) ok(`Node.js ${process.versions.node}`);
else fail(`Node.js ${process.versions.node}`, "Se requiere Node.js 22.19 o superior.");

try {
  await mkdir(config.downloadDir, { recursive: true, mode: 0o700 });
  await access(config.downloadDir, constants.W_OK);
  ok("El directorio de descargas es escribible");
} catch {
  fail("El directorio de descargas no es escribible", "Revisa permisos o cambia TOR_DOWNLOAD_DIR.");
}

console.log("\nTor");
const socks = new URL(config.socksUrl);
const listening = await new Promise((resolve) => {
  const socket = connect({ host: socks.hostname, port: Number(socks.port || 1080) });
  socket.setTimeout(3_000);
  const finish = (result) => {
    socket.destroy();
    resolve(result);
  };
  socket.once("connect", () => finish(true));
  socket.once("timeout", () => finish(false));
  socket.once("error", () => finish(false));
});

if (!listening) {
  fail(
    `Nada escucha en ${socks.host}`,
    "Inicia Tor: `brew services start tor` (macOS) o `sudo systemctl start tor` (Linux)."
  );
} else {
  ok(`Proxy SOCKS5 escuchando en ${socks.host}`);

  const exitIps = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await context.web.run(async (circuit) => {
      const { response } = await context.web.fetch(circuit, "https://check.torproject.org/api/ip", {
        headers: { accept: "application/json" }
      });
      const body = await context.web.readText(response);
      return { done: true, result: { ok: response.ok, status: response.status, body } };
    });

    if (result.isError || !result.ok) {
      const reason = result.isError ? result.content[0].text : `check.torproject.org respondió HTTP ${result.status}`;
      fail("No se pudo salir a internet por Tor", reason);
      break;
    }

    const payload = JSON.parse(result.body);
    if (!payload.IsTor) {
      fail(`El tráfico NO sale por Tor (IP ${payload.IP})`, "TOR_SOCKS5 apunta a un proxy que no es Tor.");
      break;
    }
    exitIps.push(payload.IP);
  }

  if (exitIps.length === 2) {
    ok(`El tráfico sale por Tor (nodo de salida ${exitIps[0]})`);
    if (exitIps[0] !== exitIps[1]) ok(`Circuitos independientes por llamada (${exitIps[1]} en la segunda)`);
    else info("Las dos llamadas usaron el mismo nodo de salida (puede pasar; no es un error).");
  }
}

console.log(failures === 0 ? "\nTodo listo. ✓" : `\n${failures} problema(s) encontrado(s).`);
process.exit(failures === 0 ? 0 : 1);
