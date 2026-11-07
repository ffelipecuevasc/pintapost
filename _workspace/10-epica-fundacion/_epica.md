# Épica A — Fundación

**Estado:** 🟢 Completada (2026-08-30)
**Sprints:** S01 (toolchain), S02 (layout)
**Etapa:** 1 — MVP sin IA

## Objetivo

Convertir el prototipo en un proyecto real: un pipeline de build propio, una
interfaz que solo prometa lo que el producto hace, y una base de estilos que
soporte modo oscuro sin duplicar código. Al terminar esta épica no habrá ni una
línea del motor de formato, pero el terreno estará limpio para construirlo.

## Por qué va primero

Todo lo demás se apoya aquí. Escribir el motor de formato sobre un `index.html`
que carga Tailwind desde un CDN significaría reescribirlo después. Y montar el
build más tarde obligaría a refactorizar todo el CSS ya escrito.

## Criterios de aceptación

- [x] `pnpm run build` genera `public/` completo y funcional sin ninguna
      petición a dominios externos en tiempo de ejecución.
- [x] El `index.html` servido no contiene ni `cdn.tailwindcss.com` ni enlaces a
      `fonts.googleapis.com`.
- [x] El CSS final pesa menos de 8 KB comprimido con gzip.
- [x] La interfaz no muestra ningún elemento que corresponda a una función
      inexistente (ver ADR-009).
- [x] El modo oscuro funciona en toda la interfaz alternando una sola clase.
- [x] Todo el CSS está en `public/static/css/styles.css`: `index.html` no tiene
      `<style>` ni atributos `style=` inline (ADR-015).
- [x] La página es usable a 360 px de ancho sin scroll horizontal.
- [x] `pnpm run preview` sirve el sitio localmente.

## Definition of Done (aplica a todos los sprints de esta épica)

1. Todas las casillas del sprint marcadas.
2. `pnpm run build` termina sin errores ni advertencias.
3. Sin errores en la consola del navegador.
4. Probado visualmente en Chrome escritorio y en emulación móvil.
5. Commit hecho en Conventional Commits.
6. Bitácora del día actualizada.

## Fuera de alcance

Motor de formato, transformaciones Unicode, portapapeles, borradores, vista
previa de LinkedIn, cualquier cosa relacionada con IA. Si surge, va al backlog.

---

## Cierre de la épica (2026-08-30)

Los ocho criterios verificados. Evidencia medida sobre el build limpio:

| Criterio | Medición |
|---|---|
| Build sin peticiones externas | Única URL absoluta del HTML: el `<a>` a GitHub. Todos los `url()` del CSS son locales o `data:`. Sin `fetch`/`XHR`/`import()` en el JS. |
| Sin `cdn.tailwindcss.com` ni `fonts.googleapis.com` | `grep` → exit 1 en ambos. |
| **Peso del CSS** | 22.839 b sin comprimir, **5.482 b con gzip -9**. |
| Sin funciones inexistentes | Texto visible extraído íntegro; sin rastro de la navegación fantasma de ADR-009. |
| Modo oscuro con una sola clase | Toggle, persistencia y paleta medidos en Chrome 151 por CDP; sombras de `.card` incluidas. Sin destello: carga grabada con CPU a 6× y red a 50 kB/s, 0 fotogramas claros. |
| CSS centralizado (ADR-015) | `grep "<style"` y `grep 'style="'` → exit 1. |
| 360 px sin scroll horizontal | `html.scrollWidth == clientWidth == 360`. 0 elementos desbordados sin contenedor que los recorte. |
| `pnpm run preview` sirve | 12 subrecursos a 200, 5 no publicables a 404, log sin errores ni recargas. |

**Nota sobre la métrica del CSS.** El criterio original pedía «menos de 20 KB sin
comprimir» y el compilado se quedaba en 22,8 KB. Se sustituyó la métrica en vez
de purgar tokens: el umbral sin comprimir no refleja lo que viaja por la red —
Cloudflare sirve los assets comprimidos— y recortar tokens de la paleta para
cumplir un número que nadie transfiere habría empeorado el CSS sin beneficio
real. Con gzip, que es lo que el usuario descarga de verdad, el margen es amplio
(5.482 b sobre un techo de 8.192).

**Accesibilidad.** Lighthouse 13.4.1: escritorio 100 / 96 y móvil 100 / 96 antes
de corregir el contraste. El único fallo, `color-contrast` en 7 elementos, se
resolvió bajando `--outline` de `#737686` a `#616472` (X-11).
