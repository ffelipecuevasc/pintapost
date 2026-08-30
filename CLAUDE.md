# PintaPost

Editor web que aplica formato visual a texto para LinkedIn convirtiéndolo a
caracteres Unicode matemáticos. Estático, gratuito, sin login, sin base de datos.

## Stack — no ampliar sin decisión explícita registrada en decisiones.md

- HTML5 semántico
- Tailwind CSS v3 compilado con la CLI. **Nunca el Play CDN.**
- Gestor de paquetes: **pnpm**. Nunca npm ni yarn.
- CSS: entrada en `public/static/css/styles.css`, salida en
  `public/static/css/tailwind.css`. Nunca editar el archivo de salida.
- Todo el CSS vive en `public/static/css/styles.css`. Los `.html` solo llevan
  clases: prohibido `<style>` y el atributo `style=` inline (ADR-015).
- JavaScript ES6+ nativo. **Cero dependencias de runtime.**
- Dependencias de desarrollo permitidas: tailwindcss, esbuild, wrangler.
- Tests con el runner nativo de Node (`node --test`). Sin Jest ni Vitest.
- Despliegue: Cloudflare Workers + Static Assets. **No Pages.**
- Todo lo publicable vive en `public/`, el directorio de assets. Lo que esté
  fuera de `public/` no se publica jamás. (ADR-016)

## Documentación de trabajo

La planificación vive en `_workspace/`, que está ignorada por Git.

Antes de empezar cualquier tarea, lee en este orden:

1. `_workspace/README.md` — estado actual y cuál es el sprint activo
2. `_workspace/00-producto/decisiones.md` — decisiones cerradas y su motivo

Después lee **únicamente** el archivo del sprint activo. No cargues sprints
futuros ni épicas ya completadas: gastan contexto y arrastran suposiciones viejas.

## Reglas de trabajo

- Trabaja solo dentro del alcance del sprint activo. Si detectas algo valioso
  fuera de alcance, anótalo en `_workspace/00-producto/backlog.md` y continúa.
- Al completar una tarea, marca su casilla en el archivo del sprint.
- Si una tarea requiere la consola web de GitHub o de Cloudflare, **no la
  intentes**: añádela a `_workspace/90-manual/consultas-a-claude.md` y avísame.
- Nunca escribas secretos, claves de API ni tokens en archivos del repositorio.
- Antes de terminar la sesión, actualiza `_workspace/99-bitacora/` con un
  archivo `AAAA-MM-DD.md`.

## Decisiones de arquitectura que no debes revertir

- El editor guarda `{ text, ranges }` como fuente de verdad y muestra el
  formato con CSS real. La conversión a Unicode ocurre **solo al copiar**.
  Nunca introduzcas caracteres matemáticos dentro del editor.
- Los mapeos Unicode usan los bloques **Sans-Serif** (U+1D5D4 / U+1D5EE /
  U+1D608 / U+1D622), no los Serif.
- Los hashtags (`#`) y menciones (`@`) nunca reciben formato Unicode.
- Todo el CSS se centraliza en `public/static/css/styles.css`. Ningún `.html`
  contiene `<style>` ni atributos `style=` inline; lo que no encaje en una
  utilidad de Tailwind se declara como componente o utilidad en `styles.css`.
  Única excepción: el script de tema puede fijar propiedades vía JS en runtime
  para evitar el destello en modo oscuro. (ADR-015)

## Convenciones de código

- Textos de interfaz y comentarios en español. Nombres de variables, funciones
  y archivos en inglés.
- Todo mapeo o transformación Unicode debe tener test en `tests/`.
- Commits en Conventional Commits, con descripción en español.
  Ejemplo: `feat(editor): añadir contador dual de caracteres`
- Nunca uses `localStorage` para nada que no sean borradores del usuario.
