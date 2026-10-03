# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí. El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

---

## [Unreleased]

### Documentación y estructura alineadas con mcp-memory
- El README principal está ahora en español, con espejo en inglés en `README.en.md`.
- Nuevos `docs/INSTALL.md` (instalación por sistema operativo y todas las variables) y `docs/CLIENTS.md` (configuración por cliente y referencia de las tools).
- `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md` y `CLAUDE.md` están ahora en español.

### Added
- `npm run doctor`: diagnóstico del entorno. Verifica Node.js, el directorio de descargas, que Tor escuche, que el tráfico salga realmente por Tor y que cada llamada use un circuito distinto.
- `npm run smoke`: prueba de punta a punta contra Tor real, con el servidor arrancado por stdio.
- `npm run lint` con ESLint, que se ejecuta en la CI como job previo a los tests.
- Workflow de release: al publicar un tag `v*` se ejecutan los tests y se crea la GitHub Release.

---

## [0.3.0] — 2026-10-03

Primera versión pública.

### Seguridad y privacidad
- **Sin fugas de DNS.** Los hostnames ya no se resuelven localmente; los resuelve Tor. El comportamiento anterior sigue disponible con `TOR_LOCAL_DNS_CHECK=true`, solo para proxies que no son Tor.
- **Las cookies de sesión se limitan a su dominio y su ruta** (tough-cookie, RFC 6265). Antes, una sesión enviaba todas sus cookies a cualquier host, incluso tras redirecciones a otros sitios.
- **`download_file` solo escribe dentro de `TOR_DOWNLOAD_DIR`** (por defecto `~/Downloads/tor-mcp-proxy`). Nunca sobrescribe archivos y rechaza las rutas ocultas y los symlinks que salen del directorio. Antes podía sobrescribir archivos del directorio de trabajo, incluido el propio código del servidor.
- `download_file` ya no acepta HTML ni SVG.
- El User-Agent por defecto es ahora el de Tor Browser, en lugar del de Chrome.
- Las redirecciones de `search_onion` pasan las mismas validaciones que el resto de peticiones.
- El log de auditoría se crea con permisos `0600`.
- undici se actualiza a 8.11.2 para corregir advisories publicados.

### Fixed
- Las redirecciones se comportan como en un navegador: un `POST` pasa a ser `GET`, sin cuerpo, con 301, 302 y 303.
- El TLS relajado para `.onion` funciona en todas las tools y en cada salto de redirección.
- `download_file` reintenta las respuestas bloqueadas. Antes, una página 403 se reportaba como tipo de contenido no permitido.
- En modo sesión ya no se reintentan los bloqueos con el mismo circuito.
- Las sesiones expiran tras 30 minutos **de inactividad**, como dice la documentación, y no 30 minutos después de crearse.
- Ahora se respeta `TOR_MAX_DOWNLOAD_BYTES`.
- La extracción de enlaces maneja etiquetas anidadas, entidades HTML, atributos sin comillas y enlaces relativos (con el nuevo parámetro `base_url`).
- Los enlaces de resultados de DuckDuckGo se desenvuelven a su URL real.

### Internal
- Arquitectura vertical slice: `lib/features/<tool>/` sobre un núcleo compartido (`lib/shared/`), con inyección de dependencias desde una única raíz de composición (`lib/app/`).
- El análisis de HTML es lineal, así que una página hostil ya no puede bloquear el servidor.
- Tests de punta a punta de cada tool contra un servidor HTTP local (sin Tor), un test del protocolo MCP y un test de arquitectura.
- La CI se ejecuta en Node 22 y 24 y corre `npm audit`.

---

## [0.2.0]

### Added
- Sesiones persistentes, `POST`/`PUT`/`PATCH`, y las tools `search_onion`, `download_file`, `extract_links` y `page_metadata`.

---

## [0.1.0]

### Added
- Primera versión: `fetch_page` y `check_exit_ip` por Tor, con aislamiento de circuito por petición, reintentos y soporte para `.onion`.
