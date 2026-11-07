# S02 — Reestructuración de la interfaz

**Épica:** A — Fundación
**Estado:** 🟢 Completado (2026-08-30)
**Historias:** A-05, A-06, A-07, A-08

> ⚠️ **REVISIÓN 2026-08-30.** Sustituye a la versión anterior, cuyas rutas
> apuntaban a `src/`. Tras las ADR-015/016 el directorio publicado es
> `public/`. Todas las rutas de este sprint son relativas a esa estructura.

## Objetivo

Convertir la plantilla heredada en la interfaz real de PintaPost: conservar
íntegro el lenguaje visual, eliminar todo lo que promete funciones inexistentes,
quitar las dependencias externas de fuentes e iconos, y activar el modo oscuro.

Al terminar, la aplicación no hará nada todavía — pero será honesta sobre lo que
hace, cargará sin tocar ningún dominio ajeno, y tendrá los dos temas funcionando.

## Estructura al cerrar el sprint

```
public/
├── .assetsignore
├── index.html
└── static/
    ├── css/
    │   ├── styles.css
    │   └── tailwind.css        generado
    ├── js/
    │   ├── main.js             punto de entrada
    │   └── theme.js            lógica del tema
    └── assets/
        ├── icons.svg           sprite (se entrega hecho)
        ├── favicon.svg
        └── fonts/
            └── inter-*.woff2
```

## Qué se conserva sin tocar

- La paleta Material 3 completa y la escala tipográfica.
- El `borderRadius` personalizado y la clase `.card`.
- El header sticky y el layout de tres zonas (header / aside / main).
- **La cabecera de autor simulada dentro del editor.** Es el germen de la vista
  previa de LinkedIn (historia C-02); se queda y crecerá en el S06.

---

## Tareas

### 1. Fuentes auto-hospedadas (A-05, ADR-010)

En lugar de descargar los `.woff2` a mano desde Google Fonts, usa el paquete
`@fontsource-variable/inter`, que trae los archivos ya subsetteados y con
licencia incluida. Es una dependencia de desarrollo: no llega al navegador, solo
sirve para copiar los archivos.

- [x] `pnpm add -D @fontsource-variable/inter`
- [x] Añadir al `package.json` un script `build:fonts` que copie los `.woff2`
      del subconjunto **latin** y **latin-ext** desde `node_modules` a
      `public/static/assets/fonts/`. Encadenarlo en `build`.
- [x] Declarar los `@font-face` en `public/static/css/styles.css`, con
      `font-display: swap` y los `unicode-range` correspondientes a cada
      subconjunto. Es la fuente variable, así que basta un `@font-face` por
      subconjunto con `font-weight: 400 900`.
- [x] Eliminar del `<head>` los dos `<link rel="preconnect">` y el `<link>` a
      `fonts.googleapis.com`.
- [x] Añadir `<link rel="preload" as="font" type="font/woff2" crossorigin>`
      **solo** para el subconjunto latin.
- [x] Añadir `public/static/assets/fonts/` a `.gitignore` si los archivos se
      generan en el build; si prefieres versionarlos, déjalos y anótalo.
      → **Se generan en el build** (`build:fonts`), así que van a `.gitignore`.
      Se copian 6 archivos en lugar de 2:
      - Las dos caras *italic* de latin y latin-ext, porque el editor renderiza
        la cursiva con CSS real (ADR-003) y sin ellas el navegador la
        sintetizaría inclinando la romana.
      - El subconjunto **vietnamita** (normal + italic, 10 kB cada uno), único
        de Inter que trae `U+0301` y `U+0303`, las marcas combinables que
        necesita la composición de vocales acentuadas de ADR-005. Su
        `unicode-range` se acota a esas marcas para que no se descargue por
        letras vietnamitas que la aplicación nunca va a producir.

      Solo se precarga latin normal: las otras cinco caras entran únicamente
      cuando aparece en pantalla un glifo de su rango.

### 2. Sprite de iconos (A-05, ADR-010)

El sprite viene hecho: `icons.svg`, con 16 símbolos de trazo coherente.

- [x] Colocar `icons.svg` en `public/static/assets/`.
- [x] Reemplazar **cada** `<span class="material-symbols-outlined">nombre</span>`
      por:
      ```html
      <svg class="w-5 h-5" aria-hidden="true"><use href="/static/assets/icons.svg#id"></use></svg>
      ```
      Correspondencias: `format_bold`→`bold`, `format_italic`→`italic`,
      `format_list_bulleted`→`list-bulleted`, `format_list_numbered`→
      `list-numbered`, `content_copy`→`copy`, `expand_more`→`chevron-down`,
      `person`→`person`, `public`→`globe`.
      → Migrados los **7** que sobreviven al sprint. Los otros 14 `<span>` viven
      dentro de bloques que borran la tarea 3 (navegación fantasma, sidebar,
      generador de IA, bottom nav) y la 6 (botón de emojis): migrarlos sería
      trabajo tirado. `expand_more`→`chevron-down` no tiene destino todavía —
      su único uso era el `<select>` del generador de IA; el símbolo queda
      disponible para el panel colapsable de la tarea 9.
      Tamaños: `w-5 h-5` en barra y botón de copiar; en la cabecera de autor se
      conservan los del prototipo (`text-2xl`→`w-6 h-6`, `text-[14px]`→`w-3.5 h-3.5`).
- [x] Eliminar el `<link>` de Material Symbols del `<head>`.
- [x] Eliminar del bloque `<style>` las reglas `.material-symbols-outlined` y
      `.icon-fill`. **El bloque `<style>` debe quedar vacío: bórralo entero.**
- [x] Verificar que ningún icono queda sin migrar buscando
      `material-symbols` en todo el HTML.
      → Se dejó pendiente a propósito mientras quedaba marcado condenado. Con
      el botón de emojis fuera (tarea 6) el grep devuelve **0**. Cerrada.
- [x] Añadir `.gitkeep` a `public/.assetsignore` (hoy se publica un archivo
      vacío innecesario).

### 3. Limpieza de la navegación fantasma (A-06, ADR-009)

Eliminar por completo del `index.html`:

- [x] Nav de escritorio: `Dashboard`, `Analytics`, `Settings`.
- [x] Botones de notificaciones y de cuenta del header.
- [x] Botón "New Post".
- [x] Del sidebar: `Templates`, `Library`, `Schedule`, `Help`, `Settings`.
      → Queda vivo el enlace `Editor` (icono `edit_note`), que esta lista no
      menciona. No lo toco aquí porque la tarea 5 sustituye el `<aside>` entero;
      desaparece allí junto con el último `material-symbols` del sidebar.
- [x] Bloque "Workspace / Creator Pro" y botón "Upgrade Plan".
- [x] Bottom nav móvil de tres secciones.
- [x] Sección "Generador de Ideas IA" **completa**, incluido el `<select>` de
      temas. No dejarla oculta ni con un "próximamente": vuelve en la Etapa 2.
- [x] La insignia "Draft" de la barra de herramientas (no significa nada aún).
- [x] El `class="light"` del `<html>`: no tiene regla en ninguna parte y el
      modo claro es el `:root` por defecto.

### 4. Header nuevo

- [x] Izquierda: "PintaPost" con el estilo actual, y a su lado un tagline corto
      (`Formato que LinkedIn no borra`), oculto por debajo de `sm`.
- [x] Derecha: botón de tema (icono `sun`/`moon`) y enlace al repositorio de
      GitHub (icono `github`, con `aria-label`, `target="_blank"` y
      `rel="noopener noreferrer"`).
- [x] Nada más. Sin nav, sin cuenta, sin llamadas a la acción.

Notas:
- Los dos controles usan la clase `.icon-button`, nueva en `styles.css`: 44×44
  px de área táctil (adelanta A-08) con el icono a 20 px dentro. Se declara como
  componente y no como cadena de utilidades repetida porque el patrón vuelve en
  la barra de herramientas (tarea 6). ADR-015.
- El botón de tema queda con `id="theme-toggle"` y su `<use>` con
  `id="theme-toggle-icon"`, que es de donde tirará la tarea 8. Arranca con
  `#moon` y `aria-label="Activar modo oscuro"`: el estado que corresponde al
  tema claro.

### 5. Panel lateral de utilidades (A-06)

Sustituir el sidebar por un panel con estas secciones. En este sprint van
**maquetadas y vacías**, sin lógica: son cascarones que se llenan después.

- [x] **Caracteres** — marcador de posición. Real en el S05 (contador dual).
- [x] **Borradores** — marcador con un estado vacío ("Aún no hay borradores").
      Real en el S06.
- [x] **Vista previa** — marcador. Real en el S06.
- [x] Enlace a política de privacidad al pie del panel (puede apuntar a `#`).
- [x] Cada marcador debe verse deliberadamente inerte, no como un botón roto:
      texto en `text-outline`, sin `hover`, sin `cursor-pointer`.

Notas:
- El `<aside>` lleva `aria-label="Utilidades"` para nombrar el landmark
  complementario, y con él desaparece el enlace `Editor` que había sobrevivido
  a la tarea 3, junto con el penúltimo `material-symbols` del archivo.
- Dentro del panel solo hay un `hover:` y ningún `cursor-pointer`: el del enlace
  de privacidad, que sí es un control real. Los tres marcadores son `<p>` en
  `text-outline`.
- **Se promovió el logotipo del header a `<h1>`.** Es marcado de la tarea 4,
  pero el problema solo aparece aquí: tras la tarea 3 la página se había quedado
  con cero headings, y meter tres `<h2>` en el panel dejaba el documento
  empezando por nivel 2. Preflight de Tailwind ya resetea margen y tamaño de los
  headings, así que el aspecto no cambia. Jerarquía final: h1 (PintaPost) →
  h2 ×3 (Caracteres, Borradores, Vista previa).
- Comentarios del prototipo traducidos al español en las zonas tocadas.

### 6. Barra de herramientas del editor

- [x] Botones, en este orden: negrita, cursiva, subrayado, tachado, separador,
      lista con viñetas, lista numerada, separador, limpiar formato.
- [x] Quitar el botón de emojis (backlog X-04).
- [x] `role="toolbar"` con `aria-label="Formato de texto"` en el contenedor.
- [x] Cada botón: `type="button"`, `aria-label` descriptivo en español,
      `aria-pressed="false"` en los cuatro de estilo, y `title` para el tooltip.
- [x] **Sin lógica.** Los botones no hacen nada todavía: eso es el S04.

Notas:
- Los siete botones usan `.icon-button`, así que la barra ya cumple los 44×44
  px que pide la tarea 9. `gap-2` bajó a `gap-1` para compensar el botón más
  ancho.
- Los dos separadores llevan `role="separator" aria-orientation="vertical"`,
  que es el patrón de la APG para agrupar dentro de un `toolbar`.
- `aria-label` y `title` comparten texto y no llevan verbo (`Negrita`, no
  `Aplicar negrita`): en un botón con `aria-pressed` el nombre debe quedarse
  fijo y es el estado el que cambia.
- **No se añadió navegación por flechas.** La APG la espera en `role="toolbar"`
  mediante *roving tabindex*, pero eso es lógica, y la tarea 7 pide justo lo
  contrario: alcanzar todos los controles con Tab. Queda para el S04, cuando
  los botones hagan algo. → anotado en el backlog.
- Se añadió `type="button"` al botón `Copiar para LinkedIn`, que está fuera de
  la barra y no lo tenía. Sin `<form>` alrededor no rompía nada, pero su valor
  por defecto era `submit`.

### 7. Semántica y accesibilidad del editor (H-13)

- [x] Añadir al `contenteditable`: `role="textbox"`, `aria-multiline="true"`,
      `aria-label="Editor de publicación"`, `spellcheck="true"`, `lang="es"`.
- [x] **Corregir el placeholder (H-12):** cambiar `placeholder="..."` por
      `data-placeholder="..."`, añadir la clase `is-empty`, y escribir en
      `main.js` la lógica que la alterna según `el.textContent.trim() === ''`,
      escuchando `input`. La regla CSS ya existe en `styles.css`.
- [x] Verificar con Tab que se alcanzan todos los controles en orden lógico y
      que el foco es visible (la regla `:focus-visible` ya está en `styles.css`).
      → Auditado sobre el DOM: 12 elementos enfocables, ninguno con `tabindex`,
      todos con nombre accesible. Orden: tema → GitHub → privacidad → los 7 de
      la barra → editor → copiar. Falta la pasada visual en Chrome (punto 4 del
      DoD).

Notas:
- El editor recibe `id="editor"`, que es el enganche del JS y el que usará el
  S04.
- **Se retiró `focus:ring-0` del editor.** Anulaba justo lo que pide esta tarea:
  con esa utilidad puesta, el anillo de `:focus-visible` no se dibujaba sobre el
  único control donde más falta hace. Se conserva `outline-none` para no sumar
  el contorno del navegador al anillo propio.
- El `<div>` arranca en el HTML ya con la clase `is-empty`, así que el marcador
  se ve desde el primer frame y no espera a que corra `main.js`.
- La tabulación pasa por «Política de privacidad» en tercer lugar porque el
  `<aside>` va antes que el `<main>` en el DOM. Es el orden normal de un panel
  lateral y coincide con la lectura izquierda→derecha, pero salta de arriba a la
  derecha a abajo a la izquierda. La tarea 9 mueve el panel bajo el editor en
  móvil, donde el orden pasa a ser el natural.

### 8. Modo oscuro funcional (A-07)

- [x] Crear `public/static/js/theme.js` con: lectura de `localStorage`
      (`pintapost:theme`), respeto de `prefers-color-scheme` en la primera
      visita, alternancia de la clase `dark` en `<html>`, persistencia, y
      actualización del `<meta name="theme-color">`.
- [x] Importarlo desde `main.js`.
- [x] Añadir en el `<head>`, **antes de cualquier contenido**, un script inline
      mínimo que aplique la clase leyendo `localStorage`. Sin esto hay un
      destello blanco al cargar en modo oscuro.
- [x] El botón intercambia el icono `sun`/`moon` y actualiza su `aria-label`.
- [x] Verificar que la paleta completa cambia, incluidas las sombras de `.card`.
      → Comprobado sobre el CSS compilado: `:root` declara 48 tokens y `.dark`
      redefine 36. Los 12 que faltan son exactamente los roles `*-fixed` de
      Material 3, que por diseño no cambian entre temas (ya documentado en
      `styles.css`). `--shadow-card` sí cambia: `rgba(15,23,42,.05)` → `rgba(0,0,0,.35)`.
      Falta la comprobación visual en Chrome (punto 4 del DoD).

Notas:
- `<meta name="theme-color">` se añade aquí, aunque su casilla esté en la tarea
  10: sin la etiqueta en el documento no había nada que actualizar.
- **Un solo `<meta>` actualizado por JS, no el par con `media="(prefers-color-scheme)"`.**
  Ese par lo decide el sistema operativo e ignoraría el botón, que es
  precisamente lo que esta tarea añade.
- El color se calcula leyendo el token `--background` ya resuelto con
  `getComputedStyle` y pasándolo a hexadecimal, para que `styles.css` siga
  siendo la única fuente de verdad de la paleta. El script del `<head>` sí lleva
  los dos hex a mano —no puede esperar a que haya CSS— y hay una comprobación
  automática de que no derivan del token.
- Todos los accesos a `localStorage` van en `try/catch`: en ventana privada o
  con el almacenamiento bloqueado el tema sigue funcionando, solo no persiste.
- Mientras no haya preferencia guardada se escucha `change` de
  `prefers-color-scheme`; en cuanto el usuario pulsa el botón, su elección manda.

### 9. Responsive (A-08)

- [x] Por debajo de `md`, el panel lateral pasa a ser una sección colapsable
      bajo el editor, con un `<details>`/`<summary>` o un botón con
      `aria-expanded`. No una barra de navegación inferior.
- [x] La barra de herramientas hace scroll horizontal sin cortar botones
      (`no-scrollbar` ya está definida).
- [x] Área táctil mínima de 44×44 px en todos los botones.
- [x] Sin scroll horizontal a 360 px de ancho.
      → Auditado el marcado: ningún ancho fijo en px (el único `w-[720px]` es
      en realidad `max-w-`), ningún `min-w-`, ningún `whitespace-nowrap`, y el
      único contenedor que puede desbordar es la barra, que lleva su
      `overflow-x-auto no-scrollbar`. Falta medirlo en el navegador (punto 4
      del DoD).

Notas:
- **El `<aside>` se movió detrás del `<main>` en el DOM.** Es lo que hace que en
  móvil caiga bajo el editor sin ningún truco; en escritorio vuelve a la
  izquierda con `md:order-first`. De paso arregla el salto de tabulación que
  quedó anotado en la tarea 7: ahora el orden es tema → GitHub → barra → editor
  → copiar → Utilidades → privacidad, que es el de lectura en móvil.
  *Contrapartida:* en escritorio el panel se ve a la izquierda pero se tabula al
  final. Con un solo DOM y dos disposiciones, el desajuste cae en un breakpoint
  o en el otro; se elige que caiga en escritorio porque el panel es contenido
  complementario y el orden resultante (editar y luego copiar antes que las
  utilidades) sigue siendo comprensible.
- Se usó `<details open>` + `<summary>`, no un botón con `aria-expanded`: la
  segunda opción habría exigido JavaScript, y el sprint limita el JS de este
  sprint al tema y al placeholder. El `<summary>` es `md:hidden`, así que en
  escritorio el panel está siempre desplegado.
  - Aquí encuentra destino `chevron-down`, el símbolo que en la tarea 2 se quedó
    sin uso. Gira 180° al desplegar con `group-open:rotate-180`.
  - `summary::-webkit-details-marker` y la regla `::details-content` para
    escritorio van en `styles.css` (ADR-015): ninguna de las dos es expresable
    como utilidad.
- `overflow-y-auto` del `<main>` pasó a `md:overflow-y-auto`. Si no, en móvil el
  `<main>` se convierte en su propio contenedor de scroll y el panel, que ahora
  va debajo, queda fuera del flujo scrollable.
- Área táctil: los 9 controles de icono usan `.icon-button` (44×44 por
  definición) y el botón «Copiar para LinkedIn» mide 12 + 20 + 12 = 44 px de
  alto con su `py-3` y el icono de 20. Los separadores de la barra recibieron
  `shrink-0` para que el flex no los aplaste al hacer scroll.

### 10. Metadatos (adelanto de C-10)

- [x] `<meta name="description">` en español, con la propuesta de valor.
- [x] `<meta name="theme-color">` con los valores de cada tema.
      → Ya resuelto en la tarea 8, que lo necesitaba para poder actualizarlo.
      Es **un solo `<meta>` que mueve el JS**, no el par con
      `media="(prefers-color-scheme)"`: ese par lo decide el sistema operativo
      e ignoraría el botón de tema.
- [x] Open Graph básico: `og:title`, `og:description`, `og:type`, `og:locale`.
- [x] Favicon SVG en `public/static/assets/favicon.svg`, enlazado con
      `<link rel="icon" type="image/svg+xml">`.
- [x] Ajustar el `<title>` a algo en español y descriptivo.

Notas:
- `favicon.svg` **no venía entregado** (a diferencia de `icons.svg`), así que se
  dibujó: cuadrado redondeado con el color primario del tema claro y una P
  blanca. La P va como `<path>` y no como `<text>` porque el favicon se pinta
  fuera de la página, donde no existe Inter; con `<text>` cada sistema pondría
  su propia tipografía. No cambia con el tema: la pestaña se ve sobre el fondo
  del navegador, no sobre el de la aplicación.
- Longitudes: `<title>` 60 caracteres, `description` 148. Dentro de lo que
  muestran los buscadores sin recortar.
- Open Graph se queda en los cuatro que pide la tarea. **Sin `og:url` ni
  `og:image`**: el dominio se decide en el S07 (C-07) y una `og:image` apuntando
  a un host que aún no existe es peor que no ponerla.
- `og:locale` va como `es_ES`, el español genérico. Si el destino es Chile,
  cámbialo a `es_CL`.

---

## Criterios de aceptación

- [x] La pestaña **Red** no muestra ninguna petición a un dominio externo.
- [x] Buscar `material-symbols` y `googleapis` en el HTML no devuelve nada.
- [x] Ningún elemento de la interfaz corresponde a una función que no existe.
- [x] El toggle de tema funciona, persiste al recargar, y no hay destello.
- [x] No aparece texto literal de nombres de icono durante la carga.
- [x] El placeholder del editor se ve al cargar y reaparece tras escribir y
      borrar todo el contenido.
- [x] Lighthouse: Accesibilidad ≥ 95, Rendimiento ≥ 95.
- [x] Usable a 360 px de ancho sin scroll horizontal.
- [x] `pnpm run build && pnpm run preview` sirve todo correctamente.

**Los 9 verificados el 2026-08-30.** Los seis primeros por inspección del
marcado y del CSS compilado; los tres conductuales (tema, placeholder y 360 px)
conduciendo Chrome 151 por CDP, y el de Lighthouse ejecutándolo de verdad.
Evidencia resumida:

| # | Evidencia |
|---|---|
| 1 | Única URL absoluta del HTML: el `<a>` a GitHub. Todos los `url()` del CSS son locales o `data:`. Sin `fetch`/`XHR`/`import()` en el JS. |
| 2 | `grep material-symbols` y `grep googleapis` → exit 1, cero líneas. Sin `<style>` y sin `style=`. |
| 3 | Texto visible extraído íntegro: sin rastro de Dashboard, Analytics, Templates, Library, Schedule, Help, Upgrade Plan, Creator Pro, New Post, Draft ni Generador de Ideas IA. |
| 4 | Toggle, persistencia y precedencia sobre `prefers-color-scheme` medidos en Chrome. Destello descartado grabando la carga con CPU a 6× y red a 50 kB/s: 5 fotogramas, **0 claros**. Paleta contrastada nodo a nodo, sombras de `.card` incluidas. |
| 5 | Los 19 nombres de icono de Material buscados entre los nodos de texto: ninguno. |
| 6 | Con teclado real: tras borrar queda `innerHTML="<br>"` y `:empty` **deja de casar** — el método viejo habría fallado ahí — y `is-empty` reaparece con su `::before`. |
| 7 | Lighthouse 13.4.1 / Chrome 151. Escritorio **100 / 96**, móvil **100 / 96**. CLS 0 y TBT 0 ms en ambos. |
| 8 | A 360 px: `html.scrollWidth == clientWidth == 360`. Los 3 elementos que rebasan están recortados por la barra (`overflow-x: auto`); **0 sin contenedor que los recorte**. Los 7 botones miden 44×44 y el último se alcanza entero al desplazar. |
| 9 | Build limpio desde cero; los 12 subrecursos a 200 y los 5 no publicables a 404; log de wrangler sin errores ni recargas. |

## Definition of Done

1. ✅ Todas las casillas marcadas — 51/51 en las diez tareas, 9/9 en los criterios.
2. ✅ `pnpm run build` sin errores — tras `pnpm run clean`, build completo desde cero.
3. ✅ Sin errores ni advertencias en la consola del navegador — capturada por CDP
   (`Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded`,
   `Network.loadingFailed`) en carga, tras alternar el tema dos veces, escribir y
   borrar en el editor, plegar el panel y **pulsar los siete botones de la barra**,
   y en una segunda carga con el tema ya guardado: **0 mensajes, 0 excepciones,
   0 peticiones fallidas**.
4. ✅ Probado en Chrome escritorio y en emulación móvil a 360 px — Chrome 151
   headless por CDP; captura guardada.
5. ⬜ Commit en Conventional Commits en el repo público — **pendiente, lo hace el
   usuario.** Mensaje redactado y entregado.
6. ⬜ Commit de la documentación en el repo de `_workspace/` — **pendiente, lo
   hace el usuario.**
7. ✅ Bitácora del día actualizada — sección «Sesión de la noche» añadida a
   `99-bitacora/2026-08-30.md`.

## Notas para Claude Code

- **Verifica con `pnpm run preview`, nunca con el servidor integrado de
  WebStorm.** Este sirve bajo un prefijo de ruta y rompe todas las rutas
  absolutas del proyecto.
- El lenguaje visual está aprobado: **conserva colores, radios, sombras y
  tipografía tal cual**. Lo que cambia es la estructura, no la estética.
- **No implementes ninguna lógica de formato de texto.** Los botones de la
  barra son cascarones. Si te ves escribiendo una función que manipula
  caracteres Unicode, has salido del alcance: anótalo en el backlog.
- El único JavaScript de este sprint es el tema y el toggle del placeholder.
- No instales dependencias aparte de `@fontsource-variable/inter` sin preguntar.
- Si al eliminar la navegación fantasma queda una clase de Tailwind sin usar en
  ningún sitio, no pasa nada: el purge la eliminará sola.

## Pendientes para la consola web

Ninguno en este sprint.

---

## Cierre del sprint (2026-08-30)

Ninguna tarea quedó parcial: las 51 casillas de las diez tareas y los 9 criterios
de aceptación están verificados. Del DoD faltan solo los puntos 5 y 6, que son
los dos commits y los hace el usuario.

**Lo que sí se lleva el sprint por delante, hacia la épica:** el S02 cumple todo
lo que se le pidió, pero al verificarlo aparecieron dos incumplimientos de
criterios de **`_epica.md`**, no de este sprint. Quedan anotados en el backlog y
la épica A no debería cerrarse sin resolverlos:

- **Contraste AA (X-11).** Lighthouse marcó `color-contrast` en 7 elementos, todos
  con la misma causa: el token `--outline` (`#737686`) del tema claro da 4,08–4,28
  sobre los fondos del panel y del header, por debajo del 4,5 que exige AA. El
  tema oscuro está bien (5,41–6,16). Es justo la comprobación que `styles.css`
  tenía anotada como pendiente «antes de cerrar el S02»: hecha, y **falla**.
  Arreglo calculado: `--outline: #6c6f7f`, que pasa sobre los tres fondos.
- **Peso del CSS (X-12).** `tailwind.css` = 23.260 b; `_epica.md` pide < 20 KB.

También quedó pendiente la **ADR sobre `localStorage`** (X-13): `CLAUDE.md`
prohíbe usarlo para nada que no sean borradores y la tarea 8 lo exige para la
preferencia de tema. Se implementó según el sprint, por ser lo específico y lo
más reciente, y la ADR la revisa el usuario.
