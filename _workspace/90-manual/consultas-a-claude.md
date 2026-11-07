# Cola de consultas para Claude web

Cuando Claude Code se topa con algo que no puede hacer (consolas web, decisiones
de producto, diseño visual) lo anota aquí. Yo traigo estos temas al chat de
Claude, y vuelvo con la respuesta.

**Estados:** ⚪ Pendiente · 🔵 En conversación · 🟢 Resuelto

| Fecha | Tema | Sprint | Estado | Resolución |
|---|---|---|---|---|
| 2026-08-29 | Redactar los sprints S03, S04 y S05 antes de empezar la épica B | S03 | ⚪ | |
| 2026-08-29 | Nueva regla de diseño: todo el CSS en `styles.css`, cero `<style>` y cero `style=` inline en el HTML | S01/S02 | 🟢 | Cerrada como **ADR-015**. Implementación repartida: S01 (`.card` + retirada del `box-shadow` inline), S02 (eliminación del bloque `<style>` del `<head>`) |

## Qué va aquí

- Configuración en la consola de GitHub o de Cloudflare.
- Decisiones de arquitectura nuevas (que acabarán en `decisiones.md`).
- Dudas de diseño visual o de copy de la interfaz.
- Redacción de los archivos de sprints futuros.
- Revisiones de código con perspectiva externa.

## Qué NO va aquí

Cualquier cosa que sea escribir, modificar o borrar un archivo dentro del repo:
eso es trabajo de Claude Code.
