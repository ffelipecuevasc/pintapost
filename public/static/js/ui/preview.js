/**
 * PintaPost — la vista previa de LinkedIn (S06 tarea 2, C-02).
 *
 * La función más valiosa del producto, y la que tiene una sola cosa que
 * acertar: **dónde cae el corte de «…ver más»**.
 *
 * ── Renderiza la salida de `serialize()`, no el contenido del editor ───────
 *
 * Es la decisión que gobierna el archivo. El editor muestra el formato con CSS:
 * una `a` en negrita sigue siendo la letra latina `a`, pintada con Inter. Lo
 * que LinkedIn recibe al pegar es `𝗮` —U+1D5EE, otro codepoint, de un bloque
 * matemático, renderizado con la fuente de reserva que el sistema tenga para
 * ese bloque—. **Ocupa un ancho distinto.**
 *
 * Si esta vista previa pintara el contenido del editor, estaría midiendo la
 * anchura de un texto que nadie va a ver: cabrían otras palabras por línea, el
 * número de líneas saldría distinto y el corte acabaría en una palabra que no
 * es la que LinkedIn corta. Y entonces la función no sería una aproximación
 * imperfecta: sería inútil.
 *
 * De ahí que consuma `serialize(model, options)` tal cual, sin reimplementar
 * nada, y que use la pila de fuentes del sistema en vez de Inter. LinkedIn no
 * usa Inter, y aquí queremos parecernos a LinkedIn, no a nosotros.
 *
 * ── Se mide en un sitio y se pinta en otro ────────────────────────────────
 *
 * El panel lateral mide 256 px en escritorio. La columna de texto de un post
 * en el feed ronda los 523 px. Pintar la tarjeta a 256 px y contar sus líneas
 * daría un corte que no se parece al real ni de lejos.
 *
 * Así que el corte **no se mide donde se ve**. Hay una regla invisible
 * (`.preview-ruler`) del ancho exacto de LinkedIn, con su tipografía y su
 * interlineado, donde se vuelca el texto serializado y se busca en qué offset
 * termina la última línea visible. Ese offset es una propiedad del ancho de
 * LinkedIn, no del nuestro, así que sigue siendo correcto cuando la tarjeta
 * estrecha lo pinta: **las palabras que sobreviven al corte son las mismas**,
 * aunque el renglón donde caen sea otro.
 *
 * En modo Móvil sobre un teléfono la tarjeta sí alcanza el ancho real, porque
 * ahí el panel ocupa el ancho completo: la vista previa es exacta también en
 * lo visual.
 *
 * ── El corte es por líneas, no por caracteres ─────────────────────────────
 *
 * LinkedIn recorta tras un número de líneas **renderizadas**, y cuántos
 * caracteres caben en una línea depende de la palabra, de la fuente y de si el
 * texto va en negrita matemática. Contar caracteres daría un número que
 * acierta con un texto y falla con el siguiente.
 *
 * Se mide con `Range.getBoundingClientRect()` sobre la regla, en búsqueda
 * binaria: el último offset cuyo prefijo todavía cabe en N líneas. Son unas
 * doce mediciones para un post de 3.000 caracteres, no 3.000.
 *
 * ── Lo que esta vista previa NO cubre ─────────────────────────────────────
 *
 * Solo el caso de **post de solo texto**. Si la publicación lleva una imagen,
 * un vídeo o una tarjeta de enlace, LinkedIn recorta antes para dejarles sitio,
 * y el corte real cae más arriba que el simulado. Está dicho en el panel, y no
 * se intenta modelar: haría falta calibrar cada combinación por separado.
 */

"use strict";

import { serialize } from "../export/serialize.js";

/**
 * ⚠️ CONSTANTES DE CALIBRACIÓN — son aproximaciones, no medidas.
 *
 * Cuántas líneas enseña LinkedIn antes del «…ver más». Salen de observar el
 * feed, no de ninguna documentación: LinkedIn no publica este número y lo
 * cambia sin avisar. **La tarea 9 del S06 las cuadra contra el feed real**
 * publicando un post con visibilidad «Solo yo» y anotando cuál es la última
 * palabra visible.
 *
 * Las **anchuras** viven en `styles.css` como `--preview-width-mobile` y
 * `--preview-width-desktop`, porque son longitudes y ADR-015 manda que toda
 * longitud se declare en la hoja de estilos. Este archivo no necesita
 * conocerlas: le pone `data-mode` a la regla y el CSS decide cuánto mide.
 * Al calibrar hay que tocar los dos sitios, y cada uno es un bloque señalado.
 */
const LINKEDIN = {
  mobile: { lines: 3 },
  desktop: { lines: 3 },
};

/** El mismo retardo que el contador: los dos reaccionan a la misma ráfaga. */
const DEBOUNCE_MS = 150;

/** Sin corte. Se usa como valor de retorno, así que tiene nombre. */
const NO_CUT = -1;

// ── La parte pura: se prueba sin layout ────────────────────────────────────

/**
 * Un segmentador de grafemas propio.
 *
 * `counting.js` tiene uno, pero es privado y `format/` está cerrado desde el
 * S03. Duplicar seis líneas defensivas es más barato que abrir un módulo del
 * motor para exportar un detalle interno.
 */
const graphemeSegmenter = createGraphemeSegmenter();

function createGraphemeSegmenter() {
  try {
    if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
      return null;
    }
    return new Intl.Segmenter(undefined, { granularity: "grapheme" });
  } catch (error) {
    return null;
  }
}

/**
 * Retrocede `offset` hasta el principio del grafema que lo contiene.
 *
 * **Sin esto el corte parte letras por la mitad.** El texto que se mide aquí
 * es el ya serializado, donde una `a` en negrita es `𝗮`: un par subrogado de
 * dos unidades UTF-16. Cortar entre las dos mitades produce dos caracteres de
 * reemplazo en pantalla. Y una `á` en negrita son tres unidades —base
 * matemática más acento combinable—, así que un corte en medio deja el acento
 * huérfano al principio del bloque atenuado, colocado sobre la nada.
 *
 * Si el navegador no trae `Intl.Segmenter`, al menos no se parte el par
 * subrogado: es la mitad del problema y la que se ve peor.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {number} un offset que sí es frontera de grafema, `<= offset`
 */
export function snapToGrapheme(text, offset) {
  if (!Number.isFinite(offset) || offset <= 0) return 0;
  if (offset >= text.length) return text.length;

  if (graphemeSegmenter === null) {
    const code = text.charCodeAt(offset);
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
    return isLowSurrogate ? offset - 1 : offset;
  }

  let boundary = 0;
  for (const { index } of graphemeSegmenter.segment(text)) {
    if (index > offset) break;
    boundary = index;
  }
  return boundary;
}

/**
 * Parte el texto en lo que LinkedIn enseña y lo que esconde tras «…ver más».
 *
 * El salto de línea que **termina** la parte visible no se devuelve en ninguno
 * de los dos trozos. No pertenece a ninguno: es el final de la última línea
 * visible, y el corte de bloque ya lo representa. Devolverlo al principio de
 * `hidden` pintaría un renglón en blanco justo bajo la línea divisoria, que se
 * lee como un fallo de la vista previa.
 *
 * @param {string} text la cadena ya serializada
 * @param {number} offset el corte medido, en unidades UTF-16
 * @returns {{ visible: string, hidden: string }}
 */
export function cutAt(text, offset) {
  const at = snapToGrapheme(text, offset);
  return {
    visible: text.slice(0, at),
    hidden: text.slice(at).replace(/^\n/, ""),
  };
}

/**
 * El último offset de `[0, length]` que cumple `fits`.
 *
 * Separada de la medición a propósito: es la lógica más fácil de equivocar del
 * archivo —un `≤` por un `<` y el corte se va una palabra— y así se prueba
 * sin necesitar layout, que es justo lo que ningún test puede simular.
 *
 * `fits` tiene que ser **monótona**: si un prefijo no cabe, ninguno más largo
 * cabe. Se cumple porque añadir texto nunca quita líneas.
 *
 * @param {number} length
 * @param {(end: number) => boolean} fits
 * @returns {number}
 */
export function lastOffsetThatFits(length, fits) {
  let low = 0;
  let high = Math.max(0, length);

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }

  return low;
}

/**
 * Lo que dice el panel bajo la tarjeta.
 *
 * Nombra la última palabra que sobrevive al corte, y esa es la información que
 * el usuario quiere: no «se cortan 400 caracteres», sino «hasta aquí llega tu
 * gancho». Es también lo que hay que comparar con LinkedIn al calibrar
 * (tarea 9), donde lo que se anota es exactamente eso: qué palabra queda.
 *
 * @param {{ visible: string, hidden: string } | null} cut `null` si no hay corte
 * @returns {string}
 */
export function describeCut(cut) {
  if (cut === null) return "Se ve entero, sin «…ver más».";

  const lastWord = cut.visible.trim().split(/\s+/).pop() ?? "";
  if (lastWord === "") return "El corte cae al principio del texto.";

  return `Se corta tras «${lastWord}».`;
}

// ── La medición: necesita layout de verdad ─────────────────────────────────

/**
 * El interlineado de la regla, en píxeles.
 *
 * `styles.css` le da un `line-height` explícito justamente para que esto no
 * tenga que interpretar `normal`, que no es un número y varía por fuente. El
 * respaldo cubre el caso de que alguien lo quite sin darse cuenta.
 *
 * @param {HTMLElement} ruler
 * @returns {number}
 */
function lineHeightOf(ruler) {
  const style = getComputedStyle(ruler);
  const declared = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(declared) && declared > 0) return declared;

  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.4 : 20;
}

/**
 * En qué offset termina la línea `maxLines`, medido sobre la regla.
 *
 * @param {HTMLElement} ruler la regla invisible, ya con el ancho del modo
 * @param {string} text la cadena serializada
 * @param {number} maxLines cuántas líneas enseña LinkedIn
 * @returns {number} el offset del corte, o `NO_CUT` si el texto cabe entero
 */
function measureCut(ruler, text, maxLines) {
  ruler.textContent = text;

  const node = ruler.firstChild;
  if (!node) return NO_CUT;

  const lineHeight = lineHeightOf(ruler);
  const linesOf = (height) => Math.round(height / lineHeight);

  // Sin layout no hay medición: pasa en un `display: none` heredado o con la
  // pestaña en segundo plano en algunos navegadores. Mejor no cortar nada que
  // cortar por un sitio inventado.
  const total = linesOf(ruler.getBoundingClientRect().height);
  if (total === 0 || total <= maxLines) return NO_CUT;

  const range = ruler.ownerDocument.createRange();

  return lastOffsetThatFits(text.length, (end) => {
    range.setStart(node, 0);
    range.setEnd(node, end);
    return linesOf(range.getBoundingClientRect().height) <= maxLines;
  });
}

// ── El módulo ──────────────────────────────────────────────────────────────

/**
 * Arranca la vista previa.
 *
 * @param {{
 *   getModel: () => import("../editor/model.js").Model,
 *   getOptions: () => { styleCombining: boolean },
 *   root?: HTMLElement | null,
 *   ruler?: HTMLElement | null,
 *   visible?: HTMLElement | null,
 *   hidden?: HTMLElement | null,
 *   more?: HTMLElement | null,
 *   empty?: HTMLElement | null,
 *   summary?: HTMLElement | null,
 *   modes?: HTMLElement | null,
 * }} options
 * @returns {{ update: () => void, setMode: (mode: string) => void }}
 */
export function setupPreview(options) {
  const { getModel, getOptions } = options;

  const root = options.root ?? null;
  const rulerEl = options.ruler ?? null;
  const visibleEl = options.visible ?? null;
  const hiddenEl = options.hidden ?? null;
  const moreEl = options.more ?? null;
  const emptyEl = options.empty ?? null;
  const summaryEl = options.summary ?? null;
  const modesEl = options.modes ?? null;

  /**
   * Arranca en Móvil, y no es una moneda al aire: la mayoría del tráfico de
   * LinkedIn es móvil, y el móvil es además el corte más severo. Enseñar
   * primero el caso estrecho es el consejo conservador; el que escribe puede
   * pasar a Escritorio para ver que ahí cabe más, nunca al revés.
   */
  let mode = "mobile";

  /** "empty" | "full" | "cut" */
  let state = "empty";

  let timer = null;

  /**
   * El modo se escribe en dos sitios porque son dos cosas distintas: en la
   * raíz decide cómo se ve la tarjeta, y en la regla decide **cuánto mide**, que
   * es de donde sale el corte. Tiene que estar puesto antes de medir, no
   * después.
   */
  function applyMode() {
    if (root) root.dataset.mode = mode;
    if (rulerEl) rulerEl.dataset.mode = mode;
  }

  function render(cut) {
    applyMode();
    if (root) root.dataset.state = state;

    if (emptyEl) emptyEl.hidden = state !== "empty";
    if (visibleEl) visibleEl.hidden = state === "empty";
    if (moreEl) moreEl.hidden = state !== "cut";
    if (hiddenEl) hiddenEl.hidden = state !== "cut";

    if (summaryEl) {
      summaryEl.textContent = state === "empty" ? "" : describeCut(cut);
      summaryEl.hidden = state === "empty";
    }

    if (modesEl) {
      for (const button of modesEl.querySelectorAll("[data-mode]")) {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      }
    }
  }

  function update() {
    applyMode();
    const text = serialize(getModel(), getOptions());

    if (text === "") {
      state = "empty";
      if (visibleEl) visibleEl.textContent = "";
      if (hiddenEl) hiddenEl.textContent = "";
      render(null);
      return;
    }

    const offset =
      rulerEl === null ? NO_CUT : measureCut(rulerEl, text, LINKEDIN[mode].lines);

    if (offset === NO_CUT) {
      state = "full";
      if (visibleEl) visibleEl.textContent = text;
      if (hiddenEl) hiddenEl.textContent = "";
      render(null);
      return;
    }

    const cut = cutAt(text, offset);
    state = "cut";
    if (visibleEl) visibleEl.textContent = cut.visible;
    if (hiddenEl) hiddenEl.textContent = cut.hidden;
    render(cut);
  }

  function setMode(next) {
    if (!Object.hasOwn(LINKEDIN, next) || next === mode) return;
    mode = next;
    update();
  }

  if (modesEl) {
    modesEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (button) setMode(button.dataset.mode);
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(update, DEBOUNCE_MS);
  }

  document.addEventListener("pintapost:change", schedule);
  // La casilla de compatibilidad cambia los caracteres que salen de
  // `serialize`, y con ellos el ancho de cada línea: hay que volver a medir.
  document.addEventListener("pintapost:settings", update);

  update();

  return { update, setMode };
}
