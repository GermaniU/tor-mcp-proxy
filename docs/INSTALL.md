# Instalación detallada

Esta guía cubre la instalación de Tor y del servidor, todas las variables de entorno, el diagnóstico y los problemas más comunes. Si solo quieres arrancar rápido, usa el [Quickstart del README](../README.md#-quickstart-3-comandos).

---

## Requisitos

- **Node.js 22.19 o superior.** Compruébalo con `node -v`.
- **Tor** corriendo localmente con su proxy SOCKS5. Por defecto escucha en `127.0.0.1:9050`.
- Un cliente MCP: Claude Code, Claude Desktop, Cursor, OpenCode, etc.

No necesitas Docker, ni base de datos, ni ninguna cuenta.

---

## 1. Instalar Tor

### macOS (Homebrew)

```bash
brew install tor
brew services start tor        # lo deja corriendo como servicio
```

### Debian / Ubuntu

```bash
sudo apt install tor
sudo systemctl enable --now tor
```

Para tener la versión más reciente, usa el [repositorio oficial del Tor Project](https://support.torproject.org/apt/).

### Fedora

```bash
sudo dnf install tor
sudo systemctl enable --now tor
```

### Arch Linux

```bash
sudo pacman -S tor
sudo systemctl enable --now tor
```

### Windows

Tienes dos opciones:

- **Tor Browser abierto.** Expone un proxy SOCKS en el puerto `9150`. Define `TOR_SOCKS5=socks5://127.0.0.1:9150`.
- **Tor Expert Bundle.** Descárgalo desde [torproject.org/download/tor](https://www.torproject.org/download/tor/) y ejecuta `tor.exe`, que escucha en el puerto `9050`.

### Verificar que Tor funciona

```bash
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip
# {"IsTor":true,"IP":"185.220.xxx.xxx"}
```

---

## 2. Instalar el servidor

```bash
git clone https://github.com/GermaniU/tor-mcp-proxy.git
cd tor-mcp-proxy
npm ci
npm run doctor
```

Si `npm run doctor` termina con `Todo listo. ✓`, ya puedes [conectar tu cliente](CLIENTS.md).

---

## Variables de entorno

Todas son opcionales. Se pasan en la configuración de tu cliente MCP, normalmente en el bloque `env` (consulta [`CLIENTS.md`](CLIENTS.md)), o en tu shell si ejecutas `node index.js` a mano.

| Variable | Default | Descripción |
|---|---|---|
| `TOR_SOCKS5` | `socks5://127.0.0.1:9050` | Dirección del proxy SOCKS5 de Tor. Con Tor Browser, el puerto es `9150`. |
| `TOR_ROTATE_IDENTITY` | `true` | Usa usuario y contraseña SOCKS aleatorios en cada llamada, lo que da un circuito independiente por llamada. Ponlo en `false` solo si usas un proxy que no es Tor. |
| `TOR_LOCAL_DNS_CHECK` | `false` | Resuelve los hostnames **localmente** para rechazar IPs privadas. ⚠️ Filtra a tu resolver DNS cada sitio que visitas. Úsalo solo con proxies que no son Tor. |
| `TOR_MAX_RETRIES` | `3` | Reintentos extra con un circuito nuevo cuando hay un bloqueo o un error de red (0–5). |
| `TOR_REQUEST_TIMEOUT_MS` | `45000` | Timeout por intento. Cubre las redirecciones y la lectura del cuerpo (1000–120000). |
| `TOR_MAX_RESPONSE_BYTES` | `1048576` (1 MiB) | Tamaño máximo de página para `fetch_page` y `search_onion`. |
| `TOR_MAX_DOWNLOAD_BYTES` | `10485760` (10 MiB) | Tamaño máximo de archivo para `download_file` (hasta 50 MiB). |
| `TOR_DOWNLOAD_DIR` | `~/Downloads/tor-mcp-proxy` | El único directorio donde `download_file` puede escribir. |
| `TOR_USER_AGENT` | Tor Browser (Firefox 140 ESR) | Cabecera `User-Agent` de todas las peticiones. Cambiarla te hace destacar entre los usuarios de Tor. |
| `TOR_LOG_PATH` | *(desactivado)* | Ruta de un log de auditoría JSONL, creado con permisos `0600`. ⚠️ Registra URLs y búsquedas. |

---

## Diagnóstico

```bash
npm run doctor
```

```
tor-mcp-proxy 0.3.0 — doctor

Configuración
  · TOR_SOCKS5:           socks5://127.0.0.1:9050
  · Aislamiento:          un circuito por llamada
  · DNS local:            desactivado (sin fugas de DNS)
  · Directorio descargas: /Users/tu-usuario/Downloads/tor-mcp-proxy
  · Log de auditoría:     desactivado

Entorno
  ✓ Node.js 22.19.0
  ✓ El directorio de descargas es escribible

Tor
  ✓ Proxy SOCKS5 escuchando en 127.0.0.1:9050
  ✓ El tráfico sale por Tor (nodo de salida 185.220.xxx.xxx)
  ✓ Circuitos independientes por llamada (204.8.xxx.xxx en la segunda)

Todo listo. ✓
```

Para probar todas las tools de punta a punta contra la red real:

```bash
npm run smoke
```

---

## Configuración recomendada de Tor

La configuración por defecto de Tor funciona tal cual. Si quieres fijarla explícitamente, añade esto a tu `torrc`:

```
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
ClientRejectInternalAddresses 1
```

`IsolateSOCKSAuth` es lo que permite asignar un circuito por llamada. **No lo desactives.**

El `torrc` suele estar en:
- `/etc/tor/torrc` en Linux;
- `$(brew --prefix)/etc/tor/torrc` en macOS con Homebrew.

---

## Actualizar

```bash
cd tor-mcp-proxy
git pull
npm ci
npm run doctor
```

Después, reinicia tu cliente MCP para que cargue la nueva versión.

---

## Desinstalar

1. Quita el servidor de tu cliente. En Claude Code: `claude mcp remove tor-proxy`.
2. Borra la carpeta del repo.
3. Opcional: borra `~/Downloads/tor-mcp-proxy` y, si lo activaste, el archivo de `TOR_LOG_PATH`.

El servidor no guarda nada más en disco.

---

## Troubleshooting

**`npm run doctor` dice "Nada escucha en 127.0.0.1:9050"**
- Tor no está corriendo. Inícialo con `brew services start tor` en macOS o con `sudo systemctl start tor` en Linux.
- Si usas Tor Browser, el puerto es `9150`.

**El doctor dice "El tráfico NO sale por Tor"**
- `TOR_SOCKS5` apunta a un proxy que no es Tor. Revisa la variable en la configuración de tu cliente.

**Ves `ExperimentalWarning: SOCKS5 proxy support is experimental` en stderr**
- Es un aviso de la librería `undici`, inofensivo. No afecta al protocolo MCP, que viaja por stdout.

**Las tools no aparecen en el cliente**
- Usa una ruta **absoluta** a `index.js`.
- Reinicia el cliente; muchos solo cargan los servidores MCP al arrancar.
- En Claude Code, `claude mcp list` debe mostrar `tor-proxy … ✓ Connected`.

**Las peticiones tardan mucho o fallan por timeout**
- Tor puede tardar en construir circuitos justo después de arrancar. Espera un minuto.
- Si el problema sigue, sube `TOR_REQUEST_TIMEOUT_MS`.

**Algunos sitios siempre devuelven 403**
- Bloquean todos los nodos de salida de Tor. Busca otra fuente o la versión `.onion` del sitio, si existe.
