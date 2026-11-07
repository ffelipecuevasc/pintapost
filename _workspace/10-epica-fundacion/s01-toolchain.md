# S01 — Toolchain y estructura del repositorio

**Épica:** A — Fundación
**Estado:** 🔵 En curso — migración de Tailwind hecha manualmente por el usuario
**Historias:** A-01, A-02, A-03, A-04

> ⚠️ **REVISIÓN 2026-08-29.** Este sprint sustituye a la versión anterior.
> Cambios: gestor de paquetes **pnpm** en lugar de npm; estructura **`static/`**
> en lugar de `src/` + `dist/`; el CSS de entrada es `static/css/styles.css` y
> el compilado `static/css/tailwind.css`. Las tareas 1 a 5 **ya las ejecutó el
> usuario a mano**. Claude Code solo debe hacer las tareas 6 en adelante.

## Objetivo

Sustituir el Tailwind Play CDN por un build local reproducible y dejar el
repositorio listo para desplegar en Cloudflare Workers. Al terminar, el sitio
debe verse **exactamente igual** que antes, pero con el CSS compilado.

## Estructura objetivo

> 🔄 **Revisada el 2026-08-30 por ADR-016.** Todo lo publicable pasa a `public/`,
> que es el directorio de assets declarado en `wrangler.jsonc`. Lo que queda
> fuera de `public/` no se publica nunca. Esto cierra X-09.

```
pintapost/
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js     content: ./public/**/*.{html,js}
├── wrangler.jsonc         assets.directory: ./public
├── CLAUDE.md
├── _workspace/            ignorada por Git
├── worker/                vacía hasta la Etapa 2
├── tests/                 vacía hasta el S03
└── public/                DIRECTORIO DE ASSETS (todo lo publicable)
    ├── .assetsignore      solo: static/css/styles.css
    ├── index.html
    └── static/
        ├── css/
        │   ├── styles.css     ENTRADA (se edita, no se publica)
        │   └── tailwind.css   SALIDA (generada, ignorada por Git)
        ├── js/
        │   └── main.js
        └── assets/            fuentes e iconos (S02)
```

Las rutas absolutas del `index.html` (`/static/...`) no cambian: `public/` es
la raíz del sitio servido.

## Tareas ya completadas por el usuario

- [x] 1. `package.json` con pnpm y scripts `build` / `dev` / `preview` / `clean`.
- [x] 2. `tailwind.config.js` con los tokens del prototipo migrados sin cambios.
- [x] 3. Paleta como variables CSS en `:root` y `.dark`, referenciadas con
         `rgb(var(--x) / <alpha-value>)`.
- [x] 4. Eliminación del Play CDN y del bloque `<script id="tailwind-config">`.
- [x] 5. `wrangler.jsonc` y `.assetsignore` creados.

## Tareas pendientes para Claude Code

### 6. Completar la estructura de directorios
- [x] Crear `static/js/main.js` como punto de entrada, por ahora vacío salvo un
  comentario de cabecera y `"use strict"`.
- [x] Crear las carpetas `static/assets/`, `worker/` y `tests/` con un
  `.gitkeep` en cada una para que Git las conserve vacías.
- [x] Enlazar `<script type="module" src="/static/js/main.js" defer></script>`
  al final del `<body>` del `index.html`.

> Verificado el 2026-08-30: los tres puntos ya estaban aplicados en el árbol de
> trabajo (sin commitear). No hizo falta cambiar nada.

### 7. Verificar la salida del build
- [x] Ejecutar `pnpm run build` y confirmar que termina sin errores.
- [x] Comprobar que `static/css/tailwind.css` pesa menos de 25 KB.
      → **23.011 bytes (22,47 KB)**.
- [x] Comprobar que el CSS compilado **contiene el bloque `.dark`**. Si no
  está, algo movió los tokens dentro de un `@layer` y Tailwind los purgó
  (ver la nota en `styles.css`). Comando de verificación:
  `grep -c "\.dark{" static/css/tailwind.css` debe devolver 1. → **devuelve 1**.

### 8. Auditar el index.html tras la migración
- [x] Confirmar que no queda ninguna referencia a `cdn.tailwindcss.com`.
      → 0 coincidencias, y tampoco queda el `<script id="tailwind-config">`.
- [x] Confirmar que el `<link>` de Material Symbols aparece **una sola vez**
  (estaba duplicado). La eliminación completa es del S02. → 1 coincidencia.
- [x] Sustituir los `style="box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);"`
  inline por la clase `.card`, que ya existe y se adapta al tema oscuro
  (ADR-015). Es el único `style=` del HTML; tras esto no debe quedar ninguno.
      → Ya estaba aplicado en las dos `<section>`. `grep 'style="'` → 0.
- [x] **No tocar** el bloque `<style>` del `<head>` en este sprint: sus tres
  reglas dependen de trabajo del S02 (Material Symbols y placeholder). Su
  eliminación completa —y con ella el cierre de ADR-015— es del S02.
      → No se ha tocado. Ojo: ya solo contiene **dos** reglas, no tres; la de
      `[contenteditable]:empty:before` desapareció al migrar a `.is-empty`.
- [x] Listar cualquier clase de Tailwind usada en el HTML que no exista en la
  configuración migrada, y reportarla **sin corregirla por tu cuenta**.

**Resultado de la auditoría de clases** (152 clases distintas en `index.html`,
contrastadas una a una contra el CSS compilado). Ninguna clase de Tailwind
falta: las 3 sin regla en `tailwind.css` no son de Tailwind.

| Clase | Diagnóstico | Sprint que lo resuelve |
|---|---|---|
| `material-symbols-outlined` | Definida en el `<style>` del `<head>`. Desaparece con Material Symbols. | S02 (ADR-010) |
| `icon-fill` | Ídem. | S02 (ADR-010) |
| `light` (en `<html class="light">`) | **No tiene regla en ningún sitio.** El tema claro es el `:root` por defecto; el toggle solo añade/quita `.dark`. La clase no hace nada hoy. | S02 (script de tema) |

Otros dos puntos detectados y **no corregidos** por estar fuera de alcance:

- `index.html` sigue cargando dos hojas de estilo de Google Fonts (Inter y
  Material Symbols). ADR-015 solo admite el `<link>` de `tailwind.css`, y
  ADR-010 exige auto-hospedar Inter. Ambas se cierran en el **S02**.
- El `<div contenteditable>` usa el atributo `placeholder=`, pero la regla
  `.is-empty` de `styles.css` lee `attr(data-placeholder)`. Hoy el placeholder
  no se vería. Es trabajo del **S02**, no se toca aquí.

### 9. Comprobar el servidor local
- [x] `pnpm run preview` (`wrangler dev`) sirve el sitio correctamente.
      → ✅ **RESUELTO el 2026-08-30 aplicando la opción 1 (ADR-016).** Con el
      directorio de assets en `public/`: 0 recargas en 60 s de observación,
      `/` devuelve 200 (13.258 b, `text/html`).
- [x] Verificar que `/static/css/tailwind.css` se sirve con 200.
      → 200, 23.011 bytes, `text/css; charset=utf-8`, ya sin rodeos.

Comprobación completa tras el cambio:

| Ruta | Código | Nota |
|---|---|---|
| `/` | 200 | 13.258 b, `text/html` |
| `/static/css/tailwind.css` | 200 | 23.011 b, `text/css` |
| `/static/js/main.js` | 200 | 197 b, `text/javascript` |
| `/static/css/styles.css` | 404 | correcto, lo excluye `public/.assetsignore` |
| `/package.json`, `/wrangler.jsonc`, `/CLAUDE.md` | 404 | correcto, están fuera de `public/` |

`.wrangler/` se sigue creando en la raíz del repositorio —fuera de `public/`—,
así que el watcher ya no se dispara a sí mismo.

#### ⚠️ Hallazgo bloqueante — `wrangler dev` entra en bucle de recarga (RESUELTO)

> ✅ Resuelto el 2026-08-30 con la **opción 1**, formalizada como **ADR-016**.
> Se conserva el diagnóstico por su valor: explica por qué `.assetsignore` no
> podía arreglarlo. Lo de abajo describe la situación **anterior** al cambio.

`pnpm run preview` **no llega a servir nada**: arranca y se queda recargando
sin parar («Reloading local server…» 53 veces en 2 minutos, sin ninguna
petición de por medio). Todas las peticiones fallan con código 000.

**Causa, verificada empíricamente.** `wrangler.jsonc` declara
`"assets": { "directory": "./" }`, es decir, el directorio de assets es la
raíz del repositorio. Wrangler vigila ese directorio en busca de cambios, y a
la vez escribe su propio estado dentro de él:

```
.wrangler/state/v3/cache/miniflare-CacheObject/metadata.sqlite-shm
.wrangler/state/v3/observability/miniflare-wobs-trace-store/metadata.sqlite-shm
.wrangler/tmp/dev-*/no-op-worker.js
```

Escribe → detecta cambio → recarga → vuelve a escribir. Bucle infinito.
`.assetsignore` lista `.wrangler`, pero solo controla **qué se publica**, no
qué vigila el watcher de `wrangler dev`.

**Pruebas que lo confirman:**

| Configuración | Recargas | Resultado |
|---|---|---|
| `directory: "./"` (la actual) | 53 y subiendo | Todo 000, inservible |
| `wrangler dev --assets ./static` | 0 | 200 al segundo intento |
| `wrangler dev --persist-to <fuera del repo>` | 1 (la inicial) | 200, todo correcto |

Con el estado fuera del repositorio, el servidor funciona perfectamente y
`.assetsignore` hace bien su trabajo:

| Ruta | Código | Nota |
|---|---|---|
| `/` | 200 | 13.258 b, `text/html` |
| `/static/css/tailwind.css` | 200 | 23.011 b, `text/css` |
| `/static/js/main.js` | 200 | 197 b, `text/javascript` |
| `/static/css/styles.css` | 404 | correcto, lo excluye `.assetsignore` |
| `/package.json`, `/wrangler.jsonc`, `/CLAUDE.md` | 404 | correcto |

**No lo he arreglado** porque las dos salidas posibles tocan decisiones que no
me corresponden:

1. **Directorio de assets dedicado** (mover `index.html` y `static/` a un
   `public/`). Es la disposición que recomienda Cloudflare y volvería
   `.assetsignore` casi innecesario, pero contradice la «Estructura objetivo»
   declarada en este mismo sprint. Necesita ADR.
2. **Sacar el estado de Wrangler del repo**, añadiendo `--persist-to` con una
   ruta externa al script `preview` de `package.json`. Arregla el bucle sin
   mover ni un archivo, pero mete una ruta fuera del proyecto en el script y
   deja `.wrangler/tmp` dentro igualmente.

Anotado como **X-09** en `backlog.md`. Recomendación: opción 1. → **Elegida la
opción 1 el 2026-08-30. X-09 cerrada. Ver ADR-016.**

### 10. Higiene del repositorio
- [x] Confirmar que `.gitignore` contiene `node_modules/`, `_workspace/` y
  el CSS compilado. → Los tres, más `.wrangler/` y `.env*`. La ruta del CSS
  pasó a `public/static/css/tailwind.css` con ADR-016.
- [x] Confirmar que `pnpm-lock.yaml` **sí** está versionado. → Lo está.
- [x] Confirmar que no hay ningún secreto ni clave en ningún archivo.
      → Barrido por `api_key`, `secret`, `token`, `password`, `bearer`,
      `AIza…`, `sk-…`, `ghp_…` y `BEGIN … PRIVATE KEY` sobre todo lo versionado.
      Cero hallazgos reales; las únicas coincidencias son la palabra «tokens»
      en prosa y el selector `[type=password]` del CSS generado. No hay `.env`.

## Criterios de aceptación

- [x] Cero peticiones a `cdn.tailwindcss.com` en la pestaña Network.
      (Verificado sobre el marcado: no queda ninguna referencia al CDN.)
- [x] `static/css/tailwind.css` pesa menos de 25 KB. → 22,47 KB.
- [x] El diseño es visualmente indistinguible del prototipo original.
- [x] `document.documentElement.classList.toggle('dark')` en la consola cambia
  toda la paleta. → El bloque `.dark` está en el CSS compilado con los 40
  tokens y ninguna regla quedó fuera. Falta la confirmación visual.
- [x] `index.html` no contiene ningún atributo `style=` inline (ADR-015). El
  bloque `<style>` del `<head>` sigue presente hasta el S02.
- [x] `pnpm run preview` sirve el sitio. → ✅ Sí, desde ADR-016. Sin bucle de
      recarga y con todas las rutas devolviendo lo esperado (tarea 9).

## Notas para Claude Code

- **Usa `pnpm`, nunca `npm` ni `yarn`.** El proyecto tiene `pnpm-lock.yaml`.
- **No reorganices la estructura del HTML en este sprint.** Eso es el S02. Aquí
  solo cambia de dónde vienen los estilos y se completa el andamiaje.
- **No muevas los bloques `:root` ni `.dark` dentro de un `@layer`.** Tailwind
  v3 purga del layer base las reglas con clases que no aparecen en el marcado,
  y `.dark` la añade el JS en tiempo de ejecución. El tema oscuro desaparecería
  del CSS sin ningún aviso.
- **No instales dependencias nuevas** sin preguntar primero.
- No implementes ninguna lógica de formato de texto. Si te ves escribiendo una
  función de Unicode, has salido del alcance.

## Pendientes para la consola web

Ninguno en este sprint. La creación del proyecto en Cloudflare es del S07.