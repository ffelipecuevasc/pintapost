# Product Backlog — PintaPost

Fuente única de verdad sobre qué falta. Ordenado por prioridad dentro de cada
épica. Cuando aparezca una idea fuera del alcance del sprint activo, se añade
aquí (sección "Sin asignar") en vez de implementarla.

**Estados:** ⚪ Pendiente · 🔵 En curso · 🟢 Hecha · ⏸️ Aplazada · ❌ Descartada

---

## Épica A — Fundación

| ID | Historia | Sprint | Estado |
|---|---|---|---|
| A-01 | Como desarrollador, quiero un `package.json` con scripts de build para compilar Tailwind y minificar JS | S01 | 🟢 |
| A-02 | Como desarrollador, quiero los tokens del prototipo migrados a `tailwind.config.js` para no depender del Play CDN | S01 | 🟢 |
| A-03 | Como desarrollador, quiero la paleta como variables CSS en `:root`/`.dark` para que el modo oscuro sea un cambio de clase | S01 | 🟢 |
| A-04 | Como desarrollador, quiero `wrangler.jsonc` y `.assetsignore` configurados para desplegar en Workers | S01 | 🟢 |
| A-05 | Como desarrollador, quiero un sprite SVG inline y las fuentes auto-hospedadas para eliminar peticiones externas | S02 | 🟢 |
| A-06 | Como usuario, quiero una interfaz que solo muestre funciones que existen, sin navegación falsa | S02 | 🟢 |
| A-07 | Como usuario, quiero alternar entre tema claro y oscuro y que se recuerde mi elección | S02 | 🟢 |
| A-08 | Como usuario en móvil, quiero que el editor y la barra de herramientas sean cómodos en pantalla pequeña | S02 | 🟢 |

> **ADR-015 — CSS centralizado, sin estilos inline.** No es una historia aparte:
> se implementa a lo largo de la épica A. `.card` y la retirada del `box-shadow`
> inline en S01; eliminación del bloque `<style>` del `<head>` en S02.

## Épica B — Motor de formato

| ID | Historia | Sprint | Estado |
|---|---|---|--------|
| B-01 | Como desarrollador, quiero funciones puras que conviertan texto a bold/italic/bold-italic sans-serif | S03 | 🟢     |
| B-02 | Como usuario hispanohablante, quiero que á é í ó ú ñ ü se formateen correctamente | S03 | 🟢     |
| B-03 | Como desarrollador, quiero tests que cubran todo el abecedario, tildes, dígitos, `¿ ¡` y emojis | S03 | 🟢     |
| B-04 | Como usuario, quiero subrayado y tachado además de negrita y cursiva | S03 | 🟢     |
| B-05 | Como desarrollador, quiero saber empíricamente cómo cuenta LinkedIn los caracteres Unicode | S03 | 🟢     |
| B-06 | Como desarrollador, quiero el modelo `{text, ranges}` con operaciones de aplicar/quitar/normalizar estilo | S04 | 🟢     |
| B-07 | Como usuario, quiero ver el formato aplicado en tiempo real mientras escribo | S04 | 🔵     |
| B-08 | Como usuario, quiero que el cursor no salte al aplicar formato a una selección | S04 | 🔵     |
| B-09 | Como usuario, quiero usar Ctrl/Cmd+B y Ctrl/Cmd+I | S04 | 🔵     |
| B-10 | Como usuario, quiero un botón para limpiar el formato de una selección | S04 | 🔵     |
| B-11 | Como usuario, quiero que al pegar texto desde otra app entre limpio y sin HTML | S04 | 🔵     |
| B-12 | Como usuario, quiero listas con viñetas y numeradas | S04 | 🔵     |
| B-13 | Como usuario, quiero copiar el resultado con un botón y saber que funcionó | S05 | ⚪     |
| B-14 | Como usuario en Safari iOS, quiero que copiar funcione igual que en escritorio | S05 | ⚪     |
| B-15 | Como usuario, quiero poder copiar como texto plano accesible | S05 | ⚪     |
| B-16 | Como usuario, quiero un contador que me avise antes de pasarme del límite de LinkedIn | S05 | ⚪     |
| B-17 | Como usuario, quiero que mis hashtags y menciones no se rompan al aplicar formato | S05 | ⚪     |
| B-18 | Como usuario de Chrome en escritorio, quiero una casilla que deje mis tildes sin estilizar para que se vean bien (ADR-018) | S05 | ⚪     |

## Épica C — Lanzamiento MVP

| ID | Historia | Sprint | Estado |
|---|---|---|---|
| C-01 | Como usuario, quiero no perder mi texto si cierro la pestaña por error | S06 | ⚪ |
| C-02 | Como usuario, quiero ver cómo se verá mi post en LinkedIn, con el corte de "…ver más" | S06 | ⚪ |
| C-03 | Como usuario con lector de pantalla, quiero que el editor y la barra sean navegables y anunciados | S06 | ⚪ |
| C-04 | Como usuario, quiero saber que el texto Unicode afecta a la accesibilidad y a la búsqueda de LinkedIn | S06 | ⚪ |
| C-05 | Como usuario, quiero una página que cargue rápido en móvil con datos limitados | S06 | ⚪ |
| C-06 | Como visitante, quiero encontrar la política de privacidad | S06 | ⚪ |
| C-07 | Como responsable, quiero el sitio desplegado en un dominio propio con HTTPS | S07 | ⚪ |
| C-08 | Como responsable, quiero despliegue continuo desde `main` y previews por rama | S07 | ⚪ |
| C-09 | Como responsable, quiero métricas de uso sin cookies ni banner de consentimiento | S07 | ⚪ |
| C-10 | Como responsable, quiero metadatos sociales, favicon y `theme-color` correctos | S07 | ⚪ |
| C-11 | Como responsable, quiero validar el pegado real en los 5 entornos objetivo antes de anunciar | S07 | ⚪ |

## Épica D — Capa de IA

| ID | Historia | Sprint | Estado |
|---|---|---|---|
| D-01 | Como desarrollador, quiero un endpoint `/api/generate-idea` que oculte la clave de Gemini | S08 | ⚪ |
| D-02 | Como responsable, quiero AI Gateway con caché y rate limiting delante de Gemini | S08 | ⚪ |
| D-03 | Como responsable, quiero validación estricta del endpoint (método, tipo, tamaño, lista cerrada de temas) | S08 | ⚪ |
| D-04 | Como responsable, quiero Turnstile invisible protegiendo el endpoint | S08 | ⚪ |
| D-05 | Como responsable, quiero degradación a Workers AI y luego a ideas estáticas si Gemini falla | S08 | ⚪ |
| D-06 | Como usuario, quiero elegir tema y tono y generar una idea de post | S09 | ⚪ |
| D-07 | Como usuario, quiero ver un indicador de carga mientras la IA escribe | S09 | ⚪ |
| D-08 | Como usuario, quiero un mensaje claro si el servicio está saturado, nunca un spinner infinito | S09 | ⚪ |
| D-09 | Como usuario, quiero que la idea generada entre en el editor lista para formatear | S09 | ⚪ |
| D-10 | Como responsable, quiero verificar que la clave nunca aparece en ninguna respuesta visible al cliente | S09 | ⚪ |

---

## Sin asignar (candidatos a futuros sprints)

| ID | Idea | Origen | Estado |
|---|---|---|---|
| X-01 | Generador de "hooks": 5 primeras líneas alternativas a partir del texto | Plan v1 §4.2 | ⏸️ |
| X-02 | Reescribir / expandir el texto del usuario con IA | Plan v1 §4.2 | ⏸️ |
| X-03 | Comandos slash (`/`) para insertar listas y viñetas | Plan v1 §4.1 | ⏸️ |
| X-04 | Selector de emojis completo | Prototipo | ⏸️ |
| X-05 | Estilo monoespaciado para términos técnicos | Plan v1 §4.1 | ⏸️ |
| X-06 | Gestión de múltiples borradores con nombre | Plan v1 §4.3 | ⏸️ |
| X-07 | Exportar el post como imagen | — | ⏸️ |
| X-08 | Worker de staging con proyecto de Google Cloud separado | ADR-001 | ⏸️ |
| X-09 | Sacar el directorio de assets de la raíz del repositorio | S01 tarea 9 | ✅ |
| X-10 | Navegación por flechas en la barra de herramientas (*roving tabindex*, patrón APG para `role="toolbar"`) | S02 tarea 6 | ⏸️ |
| X-11 | **Contraste AA del token `--outline` en tema claro.** Lighthouse marca `color-contrast` en 7 elementos: 4,08–4,28 sobre los fondos del panel y del header, por debajo del 4,5 exigido. Corregido: `#737686` → `#616472` | S02 criterio 7 | 🟢 |
| X-12 | **El CSS compilado supera los 20 KB** que pedía `_epica.md`. Resuelto cambiando la métrica a «< 8 KB con gzip», sin purgar tokens | S02 cierre | 🟢 |
| X-13 | **ADR sobre `localStorage`.** `CLAUDE.md` lo prohíbe salvo para borradores; la tarea 8 del S02 lo exige para `pintapost:theme`. Hay que registrar la excepción o cambiar el enfoque | S02 tarea 8 | 🟢 |
| X-14 | Actualizar `_epica.md`: sus criterios hablan de `npm`, de `dist/` y de `static/css/styles.css`, rutas anteriores a ADR-016 | S02 cierre | 🟢 |
| X-15 | Decidir `og:locale`: se dejó `es_ES` genérico; si el público objetivo es Chile, `es_CL` | S02 tarea 10 | ⏸️ |
| X-16 | La utilidad `.pb-safe` quedó definida en `styles.css` y sin usar desde que se eliminó la bottom nav | S02 tarea 3 | ⏸️ |
| X-17 | Reflujo forzado en `theme.js`: `getComputedStyle` justo tras alternar la clase `dark`. Coste medido 0 ms y ocurre una vez, pero Lighthouse móvil lo señala | S02 criterio 7 | ⏸️ |
| X-18 | Desajuste entre orden visual y orden de foco en escritorio: el panel se ve a la izquierda y se tabula al final. Decisión consciente del S02 tarea 9 | S02 tarea 9 | ⏸️ |
| X-19 | `::details-content` (Chrome 131+, Safari 18.4+) es la red de seguridad para reabrir el panel si se pliega en móvil y luego se ensancha la ventana. En navegadores sin soporte ese caso queda sin salida | S02 tarea 9 | ⏸️ |
| X-20 | Evaluar si `latin-ext` es necesario; el subconjunto `latin` ya cubre á é í ó ú ñ ü ¿ ¡ | Épica A cierre | ⚪ |
| X-21 | El subrayado y el tachado **sí** se aplican a los espacios, para que la línea salga continua entre palabras, y **no** se aplican a los saltos de línea, donde la marca quedaría flotando al principio de la línea siguiente. Política fijada al implementar `toStyled`; confirmar que es la deseada al validar en LinkedIn (S03 tarea 5) | S03 tarea 2 | ⚪ |
| X-22 | Las secuencias de emoji (tecla `1️⃣`, familias con ZWJ, banderas, tonos de piel) no reciben transformación de bloque aunque su base sea una letra o un dígito: estilizar el `1` de `1️⃣` dejaría el marco huérfano. **Aplazado:** la detección se basa en ZWJ, U+FE0F, U+20E3 y modificadores de tono; una secuencia futura con otro mecanismo podría recibir formato en su base. Se revisa si aparece un caso real, no antes | S03 tarea 2 | ⏸️ |
| X-23 | `toStyled` deja su salida en orden canónico (NFD) para que aplicar el mismo estilo dos veces dé una cadena idéntica y no solo equivalente. Sin ese paso, el subrayado (clase 220) y la tilde (clase 230) salían en distinto orden en cada pasada | S03 tarea 2 | ⚪ |
| X-24 | El sprint pedía `"test": "node --test tests/"`, pero Node 24 ya no acepta un directorio suelto: intenta cargarlo como módulo y falla con `MODULE_NOT_FOUND`. El script quedó como `node --test "tests/**/*.test.js"`, que es la forma con patrón y funciona desde Node 21 | S03 tarea 4 | ⚪ |
| X-25 | `stripStyling` recompone con NFC, así que devuelve texto canónicamente compuesto aunque la entrada llegara descompuesta a propósito. Es lo correcto para "Limpiar formato" y lo que hace posible el criterio `stripStyling(toStyled(x)) === x`, pero conviene tenerlo presente si algún día se pega texto de una fuente que dependa de la forma descompuesta | S03 tarea 2 | ⏸️ |
| X-26 | El agrupador de grafemas de `unicode.js` es propio y aproximado (base + marcas, ZWJ, banderas), no `Intl.Segmenter`, que ADR-003 reserva para el contador. Solo decide dónde cae la marca de subrayado, así que un fallo desplaza una rayita y no corrompe texto. Si aparece un caso real mal agrupado, la salida es usar `Intl.Segmenter` también aquí | S03 tarea 2 | ⏸️ |
| X-27 | `count()` recorre el texto entero en cada llamada y el contador del S05 se dispara en cada pulsación. Con 3.000 caracteres son tres recorridos más la segmentación por grafemas por tecla. **Aplazado:** no hay test de rendimiento ni límite de tamaño, y optimizar sin medir sería a ciegas. Se mide en el S05 con el contador ya conectado; si se nota, la salida es un debounce o un recuento incremental | S03 tarea 3 | ⏸️ |
| X-28 | Unicode no tiene dígitos itálicos, así que con cursiva activa los números no cambian y en negrita-cursiva reciben solo la negrita. La barra de herramientas del S05 mostrará el botón activo mientras el usuario ve que su número no se mueve: hay que decidir si se avisa con un tooltip o se deja pasar | S03 tarea 2 | ⚪ |
| X-29 | Texto bidireccional sin probar: marcas de control como RLM, LRM y los aislantes direccionales atraviesan el motor intactas, pero no se comprobó qué ocurre visualmente si un subrayado o un tachado cae junto a una de ellas. **Aplazado:** un editor para LinkedIn en español no las produce, y probarlas bien exige contenido árabe o hebreo real. Se revisa solo si el producto se abre a esos idiomas | S03 repaso de cierre | ⏸️ |
| X-30 | **`Enter` no continúa la lista automáticamente.** Tras `• uno`, la línea siguiente sale vacía y hay que volver a pulsar el botón. **Aplazado, no olvidado:** es consecuencia directa de que las listas sean prefijos de texto y no estructura (S04, idea 2), que es la simplificación que hace barato todo lo demás. Arreglarlo no es un remate, es una tarea con diseño propio: hay que decidir qué pasa al pulsar `Enter` dos veces seguidas (¿se cierra la lista?), al borrar un prefijo a mano, y al pulsar `Enter` en mitad de una línea con prefijo. Se retoma cuando haya uso real que diga si molesta | S04 tarea 7 | ⏸️ |
| X-31 | **Estilo pendiente con el cursor colapsado.** Pulsar un estilo sin selección arma un conjunto de estilos pendientes que se aplica al siguiente texto insertado en esa posición, y se descarta al mover el cursor, al perder el foco o al volver a pulsar el mismo botón. `aria-pressed` lo refleja mientras está activo. El conjunto arranca de lo que el cursor hereda, de modo que dentro de una palabra en negrita el botón significa «lo siguiente sin negrita». **Hecho en S04 tarea 10.a**, con 10 tests de `applyStyleSet` | S04 tarea 1 | 🟢 |
| X-32 | **Arrastrar y soltar texto ya estilizado.** Era la única entrada al modelo que no pasaba ni por el teclado ni por `paste`. Ahora `drop` y `dragover` están interceptados y lo soltado entra por el mismo camino que el pegado: `cleanPastedText` y `insertPlainText`. Se distingue mover de copiar —al cancelar el `drop` el navegador deja de borrar el origen, y sin devolvérselo el texto se duplicaría—. **Hecho en S04 tarea 10.b**, con 13 tests de `dropText`. La guardia de ADR-003 vuelve a ser una red que no se pisa nunca | S04 tarea 4 | 🟢 |
| X-33 | `readModelFromDom` recorre el árbol entero en cada pulsación. Con un post largo son un recorrido del DOM y una normalización de rangos por tecla, encima de lo que ya mide X-27. **Aplazado por el mismo motivo:** no hay medición. Se mide junto con el contador en el S05, y si molesta, la salida es leer solo el bloque afectado por el `beforeinput` | S04 tarea 4 | ⏸️ |
| X-34 | Los tests de `selection.js` y `editor.js` no existían: no hay DOM en `node --test`. **Cerrada de verdad el 2026-09-01, dentro de `pnpm test`.** `linkedom` entra como dependencia de desarrollo por **ADR-020** y `tests/roundtrip.test.js` comprueba el invariante `readModelFromDom(render(m)) === m` sobre un DOM real: 10 modelos representativos, las 7 formas que inserta el navegador por su cuenta y un test de convergencia. 18/18, reproducible por cualquiera que clone el repositorio. Sigue sin cubrir lo que `linkedom` no simula —`Selection`, `Range`, composición, `caretPositionFromPoint`, arrastre—, que se verifica a mano | S04 tarea 9 | 🟢 |
| X-35 | **Deshacer nativo por menú contextual.** `Ctrl+Z` está interceptado y sustituido por el historial propio, pero «Deshacer» del menú del botón derecho no dispara `keydown`: llega como un `input` y se lee como una edición más. **El texto queda coherente** —se relee del DOM— pero el paso de historial no, así que las pilas de deshacer y rehacer se desalinean respecto a lo que el usuario cree que ha hecho. **Aplazado:** el daño es acotado y no corrompe nada, y taparlo bien exige distinguir el caso por `beforeinput` con `inputType === "historyUndo"`, que no todos los navegadores emiten igual. Se retoma si aparece un usuario que use ese menú | S04 tarea 10 | ⏸️ |
| X-36 | **El modo Móvil/Escritorio de la vista previa no se recuerda.** Cabría en ADR-017 como preferencia de interfaz (`pintapost:preview`), pero el S06 no lo pedía y añadir una tercera clave sin pedirlo parecía de más. Se retoma si al usarlo molesta volver a Móvil en cada carga | S06 tarea 2 | ⏸️ |
| X-37 | **La vista previa se mide donde no se ve.** El panel lateral mide 256 px en escritorio y la columna del feed 523 px, así que la regla invisible decide el corte y la tarjeta estrecha solo lo pinta. Las palabras que sobreviven son las correctas, pero el renglón donde cae la divisoria no se parece al del feed. En móvil no pasa: ahí el panel es ancho completo y la tarjeta alcanza el ancho real. Si al calibrar (tarea 9) el modo Escritorio resulta confuso, la salida es moverla a la columna principal | S06 tarea 2 | ⏸️ |
| X-38 | **`serialize()` se llama tres veces por ráfaga de escritura:** contador, ahorro de la casilla de compatibilidad y ahora vista previa, cada uno con su propio *debounce* de 150 ms. Sobre 3.000 caracteres son tres recorridos completos más la medición de la regla. **Se mide en la tarea 5 de este mismo sprint**, antes de decidir nada; si molesta, la salida es una serialización compartida por ráfaga en vez de una por consumidor | S06 tarea 2 | ⏸️ |

✅ **X-11 a X-14 cerradas el 2026-08-30**, en la pasada de cierre de la épica A.

- **X-11.** `--outline` bajó de `#737686` a `#616472` en `:root`. Se descartó
  `#6c6f7f` porque solo alcanzaba AA sobre 3 de los fondos claros. `#616472`
  pasa sobre todos los que la interfaz usa, con 4,80 en el peor caso
  (`--surface-container-high`). Confirmado: **Lighthouse escritorio 100/100**,
  `color-contrast` en verde con 0 elementos. El tema oscuro no se tocó.
  ⚠️ Único fondo declarado que no alcanzaría 4,5 con este valor es
  `--surface-dim` (4,19), hoy sin usar. Si algún día se usa, hay que revisarlo.
- **X-12.** No se purgó ningún token: se cambió la métrica de `_epica.md` a
  «menos de 8 KB con gzip». El umbral sin comprimir no refleja lo que se
  transfiere. Valor actual: **5.482 b** sobre un techo de 8.192.
- **X-13.** Registrada como **ADR-017 — `localStorage` acotado a datos del propio
  usuario**, y actualizada la regla correspondiente de `CLAUDE.md`.
- **X-14.** `_epica.md` actualizada: `npm`→`pnpm`, `dist/`→`public/`,
  `npx wrangler dev`→`pnpm run preview`, rutas de CSS a `public/static/css/`.

📌 **Se retiró el subconjunto vietnamita de las fuentes** (X-20 nace de ahí). Eran
2 archivos y ~21 KB que solo aportaban las marcas combinables `U+0301` y `U+0303`
de ADR-005. Consecuencia a tener presente: esas marcas ya no tienen cara propia
de Inter. Hoy da igual, porque la composición solo ocurre al copiar y el
resultado nunca se renderiza en la página; **pero si la vista previa de LinkedIn
(C-02, S06) llega a pintar texto ya serializado, habrá que reevaluarlo.**

⏸️ **X-10 aparece en el S02 pero se aplaza al S04.** La APG espera que un
`role="toolbar"` mueva el foco con las flechas y exponga un solo `tabindex="0"`.
Implementarlo en el S02 habría sido escribir lógica sobre botones que todavía no
hacen nada, y además contradice la tarea 7 del propio sprint, que pide alcanzar
todos los controles con Tab. Cuando los botones actúen (S04) se decide entre las
dos cosas; hasta entonces, Tab secuencial es accesible y correcto.

✅ **X-09 cerrada el 2026-08-30** con la opción 1, formalizada como **ADR-016 —
Directorio de assets dedicado (`public/`)**. `index.html` y `static/` se movieron
a `public/`, `wrangler.jsonc` declara `"directory": "./public"` y `.assetsignore`
vive ahora en `public/` con una sola línea. Resultado: 0 recargas, `/` y
`/static/css/tailwind.css` a 200, y todo lo no publicable a 404 por estar fuera
de `public/`. El diagnóstico original se conserva abajo.

<details>
<summary>Diagnóstico original (situación previa al cambio)</summary>

🔴 **X-09 bloqueaba `pnpm run preview` y un criterio de aceptación del S01.**
`wrangler.jsonc` declara `"assets": { "directory": "./" }`. Wrangler vigila ese
directorio y a la vez escribe ahí su propio estado (`.wrangler/state/**.sqlite-shm`,
`.wrangler/tmp/dev-*`), así que se recarga en bucle infinito y nunca llega a
servir nada. `.assetsignore` no lo evita: controla qué se publica, no qué vigila
el watcher de `wrangler dev`.

Comprobado el 2026-08-30: con `--assets ./static` → 0 recargas; con
`--persist-to` fuera del repo → 1 recarga y todo 200. Con la config actual →
53 recargas en 2 minutos y todas las peticiones a 000.

Dos salidas, ambas necesitan tu decisión:

1. **Directorio de assets dedicado** (`public/` con `index.html` y `static/`
   dentro). Es lo que recomienda Cloudflare y dejaría `.assetsignore` casi
   vacío, pero cambia la «Estructura objetivo» del S01 → merece ADR.
   *Recomendada.*
2. **`--persist-to` con ruta externa** en el script `preview`. Arregla el bucle
   sin mover archivos, pero mete una ruta de fuera del proyecto en
   `package.json` y `.wrangler/tmp` se sigue creando dentro del repo.
   *Descartada.*

</details>

⚠️ **X-02 tiene una implicación de privacidad:** enviaría el borrador del usuario
a Gemini, cuyo free tier puede usar los prompts para entrenar. Mientras solo
enviemos un tema de una lista cerrada, el riesgo es nulo. Si se implementa X-02,
hay que revisar la política de privacidad y avisar al usuario antes de enviar.

---

## Descartado

| Idea | Motivo |
|---|---|
| Publicar directamente en LinkedIn | La API de LinkedIn no es abierta ni gratuita |
| Cuentas de usuario / plan de pago | Contradice ADR-009 y los principios de producto |
| Framework de frontend | Innecesario para una sola vista; complicaría el manejo de `Selection`/`Range` |
| Workers KV para rate limiting | El propio contador se quedaría sin cuota de escritura antes que Gemini |
| Google Analytics | Obligaría a banner de consentimiento; Cloudflare Web Analytics no |
