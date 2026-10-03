# Contribuir a Tor MCP Proxy

¡Gracias por querer contribuir! Esta guía explica las reglas del proyecto y el flujo de trabajo paso a paso.

---

## 🎯 Filosofía

Tor MCP Proxy hace **una cosa**: traer contenido web por Tor para un agente IA, **sin comprometer la privacidad de quien lo usa**. Cada cambio se evalúa con una pregunta: *¿esto filtra algo fuera de Tor, o vincula peticiones que deberían ser independientes?* Si la respuesta es sí, el cambio no entra, o entra solo como opción explícita y documentada en [`SECURITY.md`](SECURITY.md).

---

## 📐 Disciplinas (no negociables)

### Clean Code
- Funciones pequeñas con nombres que se explican solos.
- Sin código muerto ni imports sin usar. ESLint lo verifica.

### SOLID (sin sobreingeniería)
- **DIP:** las features dependen de `context.web`, nunca de `undici` ni de `process.env`.
- Una interfaz solo existe cuando hay más de una implementación real, o cuando hace falta para testear sin red.

### KISS · YAGNI
- Nada de abstracciones especulativas.
- Una dependencia nueva solo entra si reemplaza código de seguridad difícil de escribir bien. `tough-cookie` es el ejemplo.

### Vertical slice architecture
- Cada tool vive en `lib/features/<tool>/`, con su schema, su handler y sus helpers privados.
- Una feature **nunca** importa otra feature.
- Lo que usan varias features va en `lib/shared/`.
- `test/architecture.test.js` hace cumplir estas reglas, así que la CI falla si se rompen.

### Tests primero (TDD bienvenido)
- **Sin tests no hay merge.** Toda corrección de bug trae su test de regresión.
- Los tests corren sin Tor y sin red: usa `createTestContext()` y `startServer()` de `test/support.js`.

### Comentarios
- Explican el **por qué**, no el qué; el nombre de la función ya cuenta el qué.
- Pueden estar en inglés o en español: elige el idioma que deje la idea más clara.

---

## 📝 Convenciones

### Idioma
- **Identificadores** (variables, funciones, archivos): en inglés.
- **Documentación:** en español (`README.md`), con espejo en inglés (`README.en.md`).
- **Commits y PRs:** en español, o en inglés si es más claro.
- **Issues:** en el idioma que prefieras.

### Conventional Commits (en español)

```
feat: añadir tool fetch_feed para RSS
fix: no reintentar 403 dentro de una sesión
docs: documentar TOR_USER_AGENT en INSTALL.md
refactor: extraer parse-results de search-onion
test: cubrir redirección 308 con cuerpo
chore: actualizar undici a 8.12
```

Primera línea de 72 caracteres como máximo.

### Pull Request
- El título va en formato Conventional Commit.
- Rellena la plantilla: qué cambia y por qué, y cómo lo probaste.
- Antes de abrirlo: `npm run lint && npm run check && npm test`.

---

## 🛠 Setup de desarrollo

```bash
git clone https://github.com/GermaniU/tor-mcp-proxy.git
cd tor-mcp-proxy
npm ci

npm run lint        # ESLint
npm run check       # sintaxis de todos los archivos
npm test            # unit + integración + protocolo MCP, ~2 s, sin red

# Contra Tor real (opcional, requiere Tor corriendo)
npm run doctor
npm run smoke
```

---

## 🆕 Cómo añadir una tool MCP

### 1. Crea la slice

```
lib/features/my-tool/
├── index.js      # { name, definition, schema, logFields, handler }
└── helper.js     # opcional: lógica que solo usa esta tool
```

```js
// lib/features/my-tool/index.js
import { z } from "zod";
import { success } from "../../shared/mcp/results.js";
import { httpUrl } from "../../shared/mcp/schema-types.js";

const inputShape = { url: httpUrl.describe("URL a consultar") };

export const myTool = {
  name: "my_tool",
  definition: { title: "My Tool", description: "Qué hace, en una frase.", inputSchema: inputShape },
  schema: z.object(inputShape).strict(),
  logFields: (input) => ({ url: input.url }),
  handler: myToolHandler
};

export async function myToolHandler({ url }, { web }) {
  const destination = await web.assertAllowed(url);
  return web.run(async (circuit) => {
    const { response } = await web.fetch(circuit, destination);
    return { done: true, result: success(await web.readText(response)) };
  });
}
```

### 2. Escribe los tests (antes de la implementación, si haces TDD)

En `test/features/`, usa `createTestContext()` para tener el cableado de producción sin Tor, y `startServer()` para levantar un sitio falso.

### 3. Regístrala

Añade la tool a la lista en `lib/features/index.js`.

### 4. Actualiza la documentación (regla anti-drift)

En el mismo PR actualiza:
- `README.md` y `README.en.md` (tabla de tools);
- `docs/CLIENTS.md` (referencia de parámetros);
- `CHANGELOG.md`.

**Un PR que cambia tools sin actualizar la documentación se rechaza.**

### 5. Abre el PR

---

## 🚫 Lo que NO va a entrar

Estos cambios no se aceptan sin un issue previo con un caso de uso real:

- Cualquier ruta de red que no pase por el proxy SOCKS: fallback directo, DNS local por defecto, telemetría.
- Ejecución de JavaScript o navegadores headless.
- Selección del país de salida.
- Logging de cuerpos, cookies o `session_id`.
- Dependencias pesadas para resolver algo que se puede hacer en unas pocas líneas.

---

## 🤔 Preguntas frecuentes

**¿Necesito Tor para desarrollar?**
No. Toda la suite corre offline. Tor solo hace falta para `npm run doctor` y `npm run smoke`.

**¿Por qué no se usa `fetch` directamente en las features?**
Porque así no se podrían testear sin red, y porque `context.web` garantiza que todo pase por Tor, con reintentos y validación de destino.

**¿Dónde reporto una vulnerabilidad?**
En privado, desde la pestaña Security del repo. Consulta [`SECURITY.md`](SECURITY.md).

---

## 📜 Código de conducta

Sé respetuoso y constructivo. Critica el código, no a las personas. Las contribuciones de cualquier nivel son bienvenidas.
