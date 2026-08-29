# PintaPost

Editor web que aplica formato a texto para LinkedIn convirtiéndolo a
caracteres Unicode matemáticos. Estático, gratuito, sin login.

## Stack (no ampliar sin decisión explícita)
- HTML5 semántico + Tailwind CSS v3 (compilado con CLI, NUNCA el Play CDN)
- JavaScript ES6+ nativo. Cero dependencias de runtime.
- Despliegue: Cloudflare Workers + Static Assets (no Pages)

## Documentación de trabajo
La planificación vive en `_workspace/` (ignorada por Git).
Antes de empezar cualquier tarea, lee:
- `_workspace/README.md` — estado actual y sprint activo
- `_workspace/00-producto/decisiones.md` — decisiones cerradas

Luego lee ÚNICAMENTE el archivo del sprint activo. No cargues sprints
futuros ni épicas completadas.

## Reglas de trabajo
- Trabaja solo dentro del alcance del sprint activo. Si detectas algo
  fuera de alcance, anótalo en `_workspace/00-producto/backlog.md` y sigue.
- Al terminar una tarea, marca su casilla en el archivo del sprint.
- Si una tarea requiere la consola de GitHub o Cloudflare, NO la intentes:
  añádela a `_workspace/90-manual/consultas-a-claude.md` y avísame.
- Antes de cerrar sesión, actualiza `_workspace/99-bitacora/`.

## Convenciones de código
- Comentarios y textos de interfaz en español; nombres de variables en inglés.
- Todo mapeo Unicode debe tener test en `tests/` (node --test, sin librerías).
- Commits en formato Conventional Commits, en español.