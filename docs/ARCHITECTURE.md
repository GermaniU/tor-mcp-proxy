# Arquitectura

## Decisiones de diseño

### Vertical slice

Cada tool MCP es una **slice vertical**: su schema, su handler y sus helpers privados viven juntos en una carpeta. Todo lo compartido está en un núcleo pequeño, y una única raíz de composición conecta las piezas. Las dependencias solo apuntan hacia dentro: `app → features → shared`.

```
index.js                       entrada stdio (3 líneas)
lib/
├── app/                       raíz de composición: el único lugar que conoce las clases concretas
│   ├── config.js              lee las variables de entorno → objeto inmutable
│   └── server.js              construye el contexto y registra cada feature en el SDK MCP
├── features/                  una carpeta por tool
│   ├── index.js               lista de tools (añadir una = una línea)
│   ├── fetch-page/            index.js · schema.js
│   ├── check-exit-ip/         index.js
│   ├── search-onion/          index.js · parse-results.js
│   ├── download-file/         index.js · storage.js
│   ├── extract-links/         index.js · extract.js
│   └── page-metadata/         index.js · metadata.js
└── shared/                    núcleo compartido: sin estado global y sin process.env
    ├── net/
    │   ├── web-client.js      WebClient: el ÚNICO puerto de red que ven las features
    │   ├── tor.js             Circuit (identidad SOCKS + dispatchers) y política de reintentos
    │   ├── http.js            redirecciones manuales, límites de tamaño, cabeceras
    │   ├── sessions.js        session_id → { circuito, cookies }, TTL deslizante
    │   └── destination.js     protección SSRF, detección de .onion, regla de redirección
    ├── html/
    │   ├── text.js            HTML → texto
    │   └── elements.js        escáner lineal de elementos (sin regex cuadráticas)
    ├── mcp/
    │   ├── results.js         success() / failure() y mensajes de error
    │   └── schema-types.js    tipos zod compartidos
    ├── errors.js              errores que nunca se reintentan
    └── log.js                 log de auditoría JSONL (opcional)
```

Añadir una tool consiste en crear una carpeta y añadir una línea en `features/index.js`. `server.js` no cambia.

### SOLID, sin sobreingeniería

| Principio | Cómo se aplica |
|---|---|
| **S**: responsabilidad única | Cada módulo de `shared/` hace una sola cosa. `tor.js` gestiona circuitos y reintentos, `http.js` las redirecciones y los límites, y `destination.js` decide qué URLs se pueden pedir. |
| **O**: abierto/cerrado | Las tools se añaden sin modificar el servidor, que recorre `features/index.js`. |
| **L**: sustitución | El `WebClient` de los tests y el de producción son intercambiables, porque los tests solo cambian la fábrica de circuitos. |
| **I**: segregación de interfaces | Cada handler recibe `(input, context)` y usa solo lo que necesita. Las tools sin red ni siquiera tocan `context`. |
| **D**: inversión de dependencias | Las features dependen de `context.web` y nunca de `undici`, SOCKS ni `process.env`. `app/server.js` construye las piezas concretas y las inyecta. |

Estas reglas no dependen de la buena voluntad: `test/architecture.test.js` hace fallar la CI si:
- `shared/` importa `features/` o `app/`;
- una feature importa otra feature o `undici`;
- algún módulo fuera de `app/` lee `process.env`.

### KISS + YAGNI

- **Tres dependencias de runtime:** el SDK MCP, `undici` (SOCKS5) y `zod`. Hay una cuarta, `tough-cookie`, que se añadió porque reemplaza código de seguridad difícil de escribir bien a mano.
- **Sin parser HTML pesado.** Un conversor y un escáner lineales bastan para el contenido que consume un LLM.
- **Sin "registry" de backends ni plugins.** Si algún día hay una segunda implementación real, se evaluará entonces.

### Tests

Todos corren **sin Tor y sin red**, en unos 2 segundos:

- `test/shared/*.test.js`: tests unitarios del núcleo.
- `test/features/network-tools.test.js`: cada tool de red de punta a punta. Usa **el mismo cableado de producción** (`createContext`), pero sus circuitos hablan con un servidor HTTP local (`test/support.js`) en lugar de con Tor. Cubre reintentos, sesiones, cookies, descargas y búsqueda.
- `test/features/server.test.js`: el protocolo MCP completo sobre un transporte en memoria.
- `test/architecture.test.js`: las reglas de capas.

Contra Tor real hay dos comandos manuales, fuera de la CI: `npm run doctor` y `npm run smoke`.

---

## Decisiones clave

| Decisión | Por qué |
|---|---|
| **Sin DNS local por defecto** | Resolver los hostnames localmente filtraría cada sitio visitado a tu resolver. Tor los resuelve en el nodo de salida, y los nodos de salida rechazan las IPs privadas. |
| **Un `Circuit` = una identidad SOCKS** | La opción `IsolateSOCKSAuth` de Tor asigna un circuito propio a cada par usuario/contraseña. Así, una identidad nueva da un nodo de salida nuevo sin reiniciar Tor. |
| **Dos dispatchers por circuito** | En `undici`, el TLS se configura por dispatcher. Separar el TLS relajado en un dispatcher exclusivo para `.onion` garantiza que el HTTPS de clearnet nunca se salte la verificación por error. |
| **Redirecciones manuales** | Así cada salto pasa la validación de destino y la regla de `.onion`. |
| **`tough-cookie`** | Limitar las cookies por dominio y ruta, con la Public Suffix List, es delicado y fácil de hacer mal. |
| **Escáner lineal en vez de regex** | Expresiones como `<a[^>]*>([\s\S]*?)</a>` se vuelven cuadráticas con HTML malformado, y una página hostil podría bloquear el servidor. |

---

## Flujo de `fetch_page`

1. `app/server.js` valida el input con el schema de la feature y escribe la entrada de auditoría (si está activada). Después llama a `fetchPage(input, context)`.
2. La feature llama a `web.assertAllowed(url)`, que aplica la protección SSRF **sin resolver DNS**.
3. `web.run(attempt, { session })` aplica la política de reintentos:
   - cada intento recibe un **circuito nuevo**;
   - si el intento devuelve `{ done: false }` (403, 429, 502, 503 o 504) o falla por un error de red, se reintenta;
   - los errores de validación, los cuerpos demasiado grandes y Tor caído no se reintentan;
   - con sesión, se reutiliza el circuito de la sesión y solo se reintentan los errores de red.
4. `web.fetch(circuit, url, …)` recorre las redirecciones a mano. En cada salto:
   - elige el dispatcher: TLS estricto en clearnet, relajado solo para `.onion`;
   - envía y guarda las cookies de la sesión;
   - vuelve a validar el destino;
   - bloquea cualquier salto de `.onion` a clearnet.
5. Lee el cuerpo con límite de tamaño, lo convierte a texto y lo trunca a 60 000 caracteres.

## Flujo de `search_onion`

1. Hace un POST a `https://duckduckgogg42….onion/html/` con un circuito nuevo. Como es un `.onion`, el tráfico nunca sale de Tor.
2. `parse-results.js` separa la página en bloques de resultado (`result__title`). En cada bloque extrae el enlace, lo desenvuelve si viene como `/l/?uddg=` y toma el snippet.
3. Devuelve una lista numerada con título, URL y descripción.

---

## No-goals (por ahora)

- **Ejecutar JavaScript.** Haría falta un navegador headless, que trae su propia huella y mucha superficie de ataque.
- **Igualar la huella de Tor Browser.** No es posible desde Node.js. Está documentado en `SECURITY.md`.
- **Transporte HTTP.** Con stdio basta para los clientes locales y no hay ningún puerto que proteger.
- **Elegir el país de salida.** Va contra el modelo de anonimato de Tor.
