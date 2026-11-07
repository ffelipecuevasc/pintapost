# Workspace de PintaPost

Espacio de trabajo local. **No se sube a GitHub** (está en `.gitignore`) y **no
se versiona**: los archivos se editan directamente, sin historial.

---

## Sprint activo

> **S06 - Pulido** - De la épica C — Lanzamiento MVP.
> El archivo del sprint lo redacto yo en Claude web antes de empezar.

Cuando termines un sprint, sustituye este bloque por el del siguiente.
Solo debe haber **un** sprint activo a la vez.

**Últimos sprints cerrados:**
- S05 — Serialización, portapapeles y contador (2026-09-01)
- S04 — Modelo de datos y editor funcional (2026-09-01)
- S03 — Motor de transformación Unicode (2026-08-31)
- S02 — Reestructuración de la interfaz (2026-08-30)
- S01 — Toolchain y estructura del repositorio

> ✅ **Épica B cerrada el 2026-09-01.** El producto funciona de principio a
> fin: se escribe, se da formato, se copia y LinkedIn lo conserva. El S05 unió
> el motor Unicode del S03 con el editor del S04 mediante una única
> segmentación compartida, y la verificación manual confirmó las tres hipótesis
> que quedaban abiertas: el formato sobrevive al pegado real, un hashtag en
> negrita **sigue siendo enlace azul**, y LinkedIn cuenta unidades UTF-16 tal y
> como suponía ADR-012. El fallo silencioso del portapapeles en Safari de iOS
> (H-17) no se reprodujo. Detalle en `20-epica-motor-formato/_epica.md`.

> ✅ **Épica A cerrada limpia.** Los dos criterios que quedaron pendientes al
> terminar el S02 se resolvieron en la pasada de cierre del 2026-08-30: contraste
> AA corregido en el token `--outline` (X-11, Lighthouse escritorio **100/100**)
> y métrica del CSS sustituida por «< 8 KB con gzip», hoy en 5.482 b (X-12).
> También se registró ADR-017 sobre `localStorage` (X-13) y se actualizaron las
> rutas de `_epica.md` (X-14).

---

## Estado de las épicas

| Épica | Nombre | Sprints | Estado |
|---|---|---|---|
| A | Fundación | S01 🟢 · S02 🟢 | 🟢 Completada |
| B | Motor de formato | S03 🟢 · S04 🟢 · S05 🟢 | 🟢 Completada |
| C | Lanzamiento MVP (Etapa 1) | S06, S07 | ⚪ No iniciada |
| D | Capa de IA (Etapa 2) | S08, S09 | ⚪ No iniciada |

Leyenda: ⚪ No iniciada · 🔵 En curso · 🟢 Completada · 🔴 Bloqueada

---

## Cómo está organizada esta carpeta

Los prefijos numéricos hacen que **el orden alfabético sea el orden de
ejecución**. Los saltos de diez permiten insertar una épica intermedia sin
renumerar nada.

| Carpeta | Contenido | Cuándo se lee |
|---|---|---|
| `00-producto/` | Visión, auditoría, decisiones (ADR), backlog y glosario. La base conceptual. | Siempre, al empezar cualquier sprint |
| `10-epica-fundacion/` | Épica A. Build, toolchain y reestructuración de la interfaz. | Durante la épica A |
| `20-epica-motor-formato/` | Épica B. Serializador Unicode, modelo del editor, portapapeles. | Durante la épica B |
| `30-epica-mvp/` | Épica C. Pulido, accesibilidad, despliegue y lanzamiento. | Durante la épica C |
| `40-epica-ia/` | Épica D. Worker, AI Gateway, Gemini, interfaz de IA. | Durante la épica D |
| `90-manual/` | Lo que Claude Code **no** puede hacer: consolas de GitHub y Cloudflare, y la cola de temas para Claude web. | Solo yo. Claude Code únicamente escribe en `consultas-a-claude.md` |
| `99-bitacora/` | Un archivo por jornada: qué se hizo y qué quedó abierto. | Solo yo. Claude Code únicamente escribe |

Dentro de cada carpeta de épica: `_epica.md` con el objetivo y los criterios de
aceptación de la épica completa, y un `sNN-nombre.md` por sprint. El guion bajo
hace que el resumen de la épica ordene antes que sus sprints.

**Las épicas B, C y D tienen solo su `_epica.md` a propósito.** Los sprints se
redactan justo antes de ejecutarlos, cuando ya se sabe cómo quedó lo anterior.

---

## Ciclo de trabajo por sprint

1. Redactar el archivo del sprint (se hace en Claude web, antes de empezar).
2. Actualizar el bloque "Sprint activo" de este README.
3. En Claude Code: `/clear`, y pedirle que lea el sprint activo y resuma su
   alcance **antes** de tocar nada.
4. Ejecutar las tareas, marcando casillas conforme se completan.
5. Al terminar: pedirle que recorra los criterios de aceptación uno por uno con
   su evidencia, no un simple "listo".
6. Commit del código en el repositorio público.
7. Actualizar este README y escribir la entrada de bitácora.

---

## Reparto de responsabilidades

| Claude web (chat) | Claude Code (WebStorm) |
|---|---|
| Redactar los archivos de sprint antes de empezarlos | Escribir código, tests, refactors |
| Decisiones de arquitectura y diseño visual | Aplicar esas decisiones al código |
| Guiar la configuración de GitHub y Cloudflare | Generar `wrangler.jsonc`, workflows, `.assetsignore` |
| Revisar código con ojos frescos | Marcar casillas y escribir la bitácora |

Regla práctica: **si es un archivo dentro del repo, es de Claude Code. Si es un
formulario en un navegador, lo hago yo con ayuda de Claude web.**

---

## Reglas de edición de esta carpeta

No hay historial de versiones aquí, así que el criterio no es *qué archivo*
sino *qué tipo de operación*. Añadir es reversible a ojo; reescribir no.

### Puede hacer libremente

- **Marcar casillas** y **actualizar campos de estado** en cualquier archivo.
- **Añadir secciones nuevas** al archivo del sprint activo: tareas surgidas
  sobre la marcha, resultados de verificación, hallazgos.
- **Añadir filas** al backlog, y actualizar el estado de las existentes.
- **Añadir ADR nuevas** al final de `decisiones.md`, y añadir bloques de
  «Resultado» o «Actualización» al final de una ADR ya existente.
- **Crear archivos** en `99-bitacora/` y en `90-manual/`.
- **Añadir términos** al glosario.

### Debe pedir permiso antes

- Reescribir la sección «Decisión» o «Motivo» de una ADR ya publicada.
- Cualquier edición que **elimine o sustituya más de cinco líneas** ya
  escritas. En ese caso: muestra cómo quedaría, espera confirmación, y luego
  aplica.

### No debe hacer

- Reescribir `vision.md` ni `auditoria-tecnica.md`.
- Crear archivos de sprint. Los redacto yo en Claude web.
- Marcar como completado algo que no haya verificado con evidencia.

### Trazabilidad

Cuando añada una sección que no venía en el sprint original, que la marque:

> _Añadida por Claude Code el AAAA-MM-DD._

Así, dentro de tres semanas, se distingue lo planificado de lo emergente.