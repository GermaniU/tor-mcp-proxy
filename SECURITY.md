# Seguridad y privacidad

Este documento explica qué protege `tor-mcp-proxy`, qué **no** protege y cómo reportar una vulnerabilidad.

*English summary: report vulnerabilities privately via the repository's **Security → Report a vulnerability** tab. Do not open public issues for security problems.*

---

## Modelo de amenazas

### Lo que protege

| Riesgo | Cómo se mitiga |
|---|---|
| Los sitios conocen tu IP real | Todo el tráfico va por el proxy SOCKS5 de Tor. No existe ningún fallback directo. |
| Tu ISP o tu resolver DNS ven qué sitios visitas | Los hostnames se envían a Tor sin resolver. Por defecto no se hace ninguna consulta DNS local (`TOR_LOCAL_DNS_CHECK=false`). |
| Distintas llamadas se pueden vincular por compartir circuito | Cada llamada usa una identidad SOCKS aleatoria, y `IsolateSOCKSAuth` (activo por defecto en Tor) le asigna su propio circuito. |
| Las cookies de un sitio llegan a otro | En las sesiones, [tough-cookie](https://github.com/salesforce/tough-cookie) guarda las cookies separadas por dominio y ruta (RFC 6265 y Public Suffix List). |
| Un `.onion` te redirige a clearnet | Se bloquea cualquier redirección de `.onion` a clearnet, en cada salto. |
| SSRF: engañan a la IA para que consulte tu red local o la metadata de tu nube | Se rechazan las IPs literales privadas, de loopback, link-local y de metadata, y los hostnames locales. Además, a través de Tor los hostnames los resuelve el nodo de salida, que rechaza las direcciones internas. |
| Una descarga sobrescribe tus archivos o planta código | Solo se escribe dentro de `TOR_DOWNLOAD_DIR`. Nunca se sobrescriben archivos, y se rechazan las rutas con `..`, los archivos ocultos, las rutas absolutas y los symlinks que salen del directorio. Tampoco se aceptan ejecutables, HTML ni SVG. |
| Respuestas enormes agotan la memoria | Los cuerpos se leen en streaming y se cortan al superar el límite configurado. |
| HTML hostil bloquea el servidor | El análisis de HTML es lineal, sin expresiones regulares cuadráticas. |

### Lo que NO protege

- **Lo que pones en la petición.** Si la IA inicia sesión con tu cuenta real o envía datos personales, Tor no puede ocultarlo.
- **El fingerprinting.** El User-Agent es el de Tor Browser, pero la huella TLS y HTTP es la de Node.js. Un sitio que lo analice puede ver que la petición no viene de Tor Browser. Eso reduce tu conjunto de anonimato, aunque no revela tu IP.
- **La vinculación dentro de una sesión.** Un `session_id` reutiliza a propósito el mismo circuito y las mismas cookies, así que las peticiones de una misma sesión se pueden vincular entre sí.
- **El espionaje del nodo de salida en HTTP plano.** El nodo de salida puede leer y modificar el tráfico clearnet sin cifrar. El tráfico `.onion` y el HTTPS están cifrados de extremo a extremo.
- **Un equipo o un cliente MCP comprometido.** El servidor confía en lo que le envía tu cliente MCP.
- **El contenido de las páginas.** Se devuelve a la IA como texto. Trátalo como entrada no confiable, porque puede contener intentos de prompt injection.

### `.onion` y TLS

Las direcciones `.onion` ya autentican criptográficamente al servidor, así que **no** se verifican los certificados HTTPS de los hosts `.onion`. Muchos servicios ocultos usan certificados autofirmados. Esta relajación solo aplica a los hosts `.onion` y usa un dispatcher separado; el HTTPS de clearnet siempre se verifica de forma estricta.

---

## Configuración que reduce la privacidad

| Ajuste | Efecto |
|---|---|
| `TOR_LOCAL_DNS_CHECK=true` | Cada hostname se resuelve con tu DNS local y queda expuesto. |
| `TOR_ROTATE_IDENTITY=false` | Todas las llamadas comparten el circuito actual de Tor y se pueden vincular entre sí. |
| `TOR_LOG_PATH=...` | Las URLs visitadas y las búsquedas se guardan en disco, con permisos `0600`. |
| `TOR_USER_AGENT=...` | Un User-Agent distinto del de Tor Browser te hace destacar entre los usuarios de Tor. |

---

## Configuración recomendada de Tor

La configuración por defecto funciona. Si quieres más seguridad, añade esto a tu `torrc`:

```
SocksPort 127.0.0.1:9050 IsolateSOCKSAuth
ClientRejectInternalAddresses 1
```

Ambas opciones ya son los valores por defecto de Tor. Fijarlas explícitamente te protege si alguien cambia la configuración.

---

## Reportar una vulnerabilidad

**No abras un issue público** para problemas de seguridad. Usa el reporte privado de GitHub: ve a la pestaña **Security** del repositorio, elige **Report a vulnerability** e incluye:

- los pasos para reproducirlo;
- el impacto (qué se filtra o qué puede hacer un atacante);
- la versión o el commit afectado.

Puedes escribir en español o en inglés.
