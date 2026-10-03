# Conectar tu cliente MCP

Tor MCP Proxy es un servidor MCP por **stdio**: el cliente lo arranca como un proceso con `node /ruta/absoluta/a/tor-mcp-proxy/index.js`. Usa siempre una ruta **absoluta**. Tienes los snippets listos en [`examples/`](../examples/).

Antes de conectar, comprueba que todo esté bien con `npm run doctor`.

---

## Claude Code

```bash
claude mcp add tor-proxy --scope user -- node /ruta/absoluta/a/tor-mcp-proxy/index.js
```

Para pasar variables de entorno:

```bash
claude mcp add tor-proxy --scope user \
  -e TOR_DOWNLOAD_DIR=/ruta/a/descargas \
  -- node /ruta/absoluta/a/tor-mcp-proxy/index.js
```

Para verificar:

```bash
claude mcp list
# tor-proxy: node /ruta/.../index.js - ✓ Connected
```

Las tools aparecen en las sesiones nuevas.

---

## Claude Desktop

Edita `claude_desktop_config.json`, que está en:
- macOS: `~/Library/Application Support/Claude/`;
- Windows: `%APPDATA%\Claude\`.

```json
{
  "mcpServers": {
    "tor-proxy": {
      "command": "node",
      "args": ["/ruta/absoluta/a/tor-mcp-proxy/index.js"],
      "env": {
        "TOR_DOWNLOAD_DIR": "/ruta/absoluta/a/descargas"
      }
    }
  }
}
```

Reinicia Claude Desktop después de guardar.

---

## Cursor

Ve a Settings → MCP Servers → Add new MCP Server, o edita `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tor-proxy": {
      "command": "node",
      "args": ["/ruta/absoluta/a/tor-mcp-proxy/index.js"]
    }
  }
}
```

---

## OpenCode

Edita `opencode.json` en tu proyecto o `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "tor-proxy": {
      "type": "local",
      "command": ["node", "/ruta/absoluta/a/tor-mcp-proxy/index.js"]
    }
  }
}
```

---

## Otros clientes MCP

Cualquier cliente que pueda lanzar un servidor MCP por stdio funciona. Solo necesita:
- **comando:** `node`;
- **argumento:** la ruta absoluta a `index.js`;
- **variables de entorno** (opcionales): las de [`INSTALL.md`](INSTALL.md#variables-de-entorno).

---

## Referencia de tools

### `fetch_page`

Descarga una página por Tor y devuelve su texto limpio, o el HTML crudo.

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `url` | string | — | URL HTTP(S) o `.onion`. |
| `raw` | boolean | `false` | Devuelve el HTML crudo en lugar del texto extraído. |
| `method` | `GET` \| `POST` \| `PUT` \| `PATCH` | `GET` | Método HTTP. |
| `body` | string | — | Cuerpo de la petición. Es obligatorio si el método no es GET y no se permite con GET. |
| `content_type` | string | — | Obligatorio si el método no es GET. Valores admitidos: `application/x-www-form-urlencoded`, `application/json`, `text/plain` y `multipart/form-data`. |
| `session_id` | string | — | Reutiliza el mismo circuito y las mismas cookies entre llamadas. |

- Rechaza las respuestas binarias (imágenes, PDFs, …). Para esos casos usa `download_file`.
- Sigue las redirecciones como un navegador: un POST pasa a ser GET con 301, 302 y 303. Vuelve a validar cada salto y **bloquea cualquier salto de `.onion` a clearnet**.
- **Sesiones:**
  - Cada `session_id` tiene su propio circuito y su propio jar de cookies, separadas por dominio.
  - La sesión expira tras 30 minutos sin uso. Como máximo hay 100 sesiones a la vez.
  - Dentro de una sesión, una respuesta bloqueada **no** se reintenta con otro nodo, porque cambiar de nodo rompería la sesión. Solo se reintentan los errores de red.

### `check_exit_ip`

No recibe parámetros. Devuelve `Exit IP: x.x.x.x`, la IP del nodo de salida de un circuito nuevo.

### `search_onion`

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `query` | string | — | Texto a buscar, de 1 a 500 caracteres. |
| `limit` | entero | `20` | Número de resultados, de 1 a 50. |

Busca en el servicio `.onion` oficial de DuckDuckGo, así que la búsqueda nunca sale de Tor. Los resultados pueden ser sitios clearnet o `.onion`.

### `download_file`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `url` | string | URL del archivo. |
| `output_path` | string | Ruta **relativa** dentro de `TOR_DOWNLOAD_DIR`, por ejemplo `informes/q3.pdf`. |

- Nunca sobrescribe archivos.
- Cada parte de la ruta debe empezar por letra, dígito o `_`, y solo puede contener letras, dígitos, `.`, `_`, `-` y espacios.
- **Tipos permitidos:** PDF, documentos de Office, PNG/JPEG/GIF/WebP, ZIP/TAR/GZIP/BZIP2/7z/RAR, texto plano, CSV, JSON y XML. Rechaza HTML, SVG y ejecutables.

### `extract_links`

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `html` | string | — | HTML a analizar, hasta 500 kB. |
| `filter_onion` | boolean | `true` | Devuelve solo los enlaces `.onion`. |
| `base_url` | string | — | Sirve para resolver enlaces relativos. Sin este parámetro, los enlaces relativos se descartan. |

### `page_metadata`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `html` | string | HTML a analizar. |
| `url` | string | URL de la página (opcional). Sirve para clasificar los enlaces en internos o externos. |

---

## Ejemplos de uso desde el agente

Puedes pedírselo a tu agente en lenguaje natural:

> "Usa `check_exit_ip` para confirmar que estás saliendo por Tor."

> "Busca con `search_onion` 'tor project onion services' y abre el primer resultado con `fetch_page`."

> "Descarga el PDF de https://example.org/informe.pdf a `informes/informe.pdf`."

> "Trae el HTML crudo de este .onion y con `extract_links` lista los otros .onion que enlaza."

Un login en varios pasos con sesión:

```json
{ "url": "https://sitio.example/login", "method": "POST",
  "content_type": "application/x-www-form-urlencoded",
  "body": "user=demo&pass=demo", "session_id": "sitio" }
```

```json
{ "url": "https://sitio.example/cuenta", "session_id": "sitio" }
```

---

## Buenas prácticas para tu agente

- **No mezcles identidad y anonimato.** Si el agente inicia sesión con tu cuenta real, el sitio sabe quién eres, aunque no vea tu IP.
- **Usa `session_id` solo cuando haga falta**, por ejemplo para logins o formularios. Sin sesión, cada llamada es anónima e independiente.
- **Trata el contenido como no confiable.** Las páginas pueden contener instrucciones dirigidas al agente (prompt injection).
- **Prefiere HTTPS o `.onion`.** En HTTP plano, el nodo de salida puede leer y modificar el tráfico.
