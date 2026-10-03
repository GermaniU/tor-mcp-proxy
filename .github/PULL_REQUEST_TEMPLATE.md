## ¿Qué cambia y por qué?

<!-- Título del PR en formato Conventional Commit (feat:/fix:/refactor:/test:/docs:/chore:).
     Primera línea de 72 caracteres como máximo.
     Aquí: explica el POR QUÉ, no el qué; el diff ya muestra el qué. -->

## ¿Cómo lo probaste?

<!-- Pasos concretos. Incluye los comandos exactos que ejecutaste.
     Si toca la red, indica si lo probaste con Tor real (`npm run smoke`). -->

---

## Checklist

- [ ] Hay tests para toda la lógica nueva (sin tests = sin merge)
- [ ] `npm run lint`, `npm run check` y `npm test` pasan
- [ ] El título del PR está en formato Conventional Commit
- [ ] Identificadores en **inglés**; commits en **español** (o en inglés si es más claro)
- [ ] Una tool nueva = una carpeta nueva en `lib/features/`; no se modificaron otras slices
- [ ] Nada de tráfico ni DNS fuera de Tor, y nada de logs nuevos de cuerpos, cookies o `session_id`
- [ ] Docs actualizadas si cambian tools o variables: `README.md`, `README.en.md`, `docs/` y `CHANGELOG.md`
