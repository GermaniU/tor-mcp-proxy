# CLAUDE.md — tor-mcp-proxy

Convenciones del proyecto para las sesiones de Claude Code y otros asistentes.

---

## Stack

- **Node.js 22.19+** con ES modules. Usa el SDK MCP por stdio, undici (SOCKS5), zod y tough-cookie.
- **Arquitectura vertical slice:**
  - cada tool vive en `lib/features/<tool>/`;
  - el núcleo compartido está en `lib/shared/`;
  - el cableado está en `lib/app/`.
  
  Añadir una tool = añadir una carpeta + una línea en `lib/features/index.js`.
- **Tests:** `npm test` (unit, integración y protocolo MCP, unos 2 s, sin Tor ni red).
- **Contra Tor real:** `npm run doctor` y `npm run smoke`. Son manuales y no forman parte de la CI.
- **Linting:** `npm run lint` (ESLint) y `npm run check` (sintaxis).

## Convenciones de código

- Identificadores en **inglés**. Commits en **español** (o en inglés si es más claro). Comentarios en el idioma que sea más claro.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- **Primero la privacidad.** Nada de tráfico ni DNS fuera de Tor, y no se registran cuerpos, cookies ni `session_id`. Si un cambio debilita `SECURITY.md`, tiene que ser opcional y quedar documentado allí.
- **DIP.** Las features usan `context.web` y nunca importan `undici`. `shared/` nunca lee `process.env` ni importa de `features/` o `app/`. Una feature nunca importa otra. Lo verifica `test/architecture.test.js`.
- **Tests sin red.** Usa `createTestContext()` y `startServer()` de `test/support.js`.
- Sin abstracciones especulativas (YAGNI).

## Regla anti-drift de docs

**Todo PR que agregue, cambie o elimine una tool MCP o una variable `TOR_*` debe actualizar, en el mismo diff:**
- `README.md` y `README.en.md`;
- `docs/CLIENTS.md` (referencia de tools) o `docs/INSTALL.md` (variables);
- `CHANGELOG.md`.

**Un PR de tools sin docs se rechaza.**
