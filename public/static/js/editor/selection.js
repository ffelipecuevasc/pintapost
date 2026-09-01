/**
 * PintaPost — el puente entre el DOM y el modelo (S04, B-06/B-07).
 *
 * Aquí se concentra la dificultad del sprint. Todo lo demás del editor trabaja
 * con números —offsets sobre `model.text`— y este archivo es el único que sabe
 * traducirlos a nodos del DOM y de vuelta.
 *
 * Cuatro funciones de posición y una de lectura:
 *
 *   domToModelOffset(root, node, offset)   punto del DOM        → offset
 *   modelOffsetToDom(root, offset)         offset               → punto del DOM
 *   getSelection(root)                     selección del usuario → { from, to }
 *   setSelection(root, from, to)           { from, to }          → selección
 *   readModelFromDom(root)                 árbol del editor      → { text, ranges }
 *
 * ── Por qué los offsets son estables y los nodos no ────────────────────────
 *
 * Guardar la selección como "nodo X, carácter 3" no sirve: al aplicar negrita
 * el contenido se repinta entero y ese nodo deja de existir. Guardarla como
 * "carácter 17 del texto" sí, porque el texto plano no cambia al cambiar el
 * formato. De ahí el orden obligatorio de cualquier comando: leer la selección
 * como offsets, mutar el modelo, renderizar, y volver a colocarla.
 *
 * ── Leer es más difícil que escribir ───────────────────────────────────────
 *
 * `render.js` produce un árbol limpio y predecible, así que colocar el cursor
 * es sumar longitudes de nodos de texto. Pero al teclear no repintamos, y lo
 * que queda en el DOM lo decide el navegador: Chrome envuelve cada línea nueva
 * en un `<div>`, Firefox mete `<br>`, y al borrarlo todo queda un `<br>`
 * residual que no representa ningún salto de línea real.
 *
 * `readModelFromDom` normaliza esas tres formas de escribir lo mismo:
 *
 *   - `<br>`            un salto de línea, salvo que sea el relleno final.
 *   - `<div>`, `<p>`…   un salto de línea antes de su contenido, si no es lo
 *                       primero que hay en el editor.
 *   - `<strong>`…       un estilo, en cualquier orden de anidamiento.
 *
 * ── El `<br>` de relleno ───────────────────────────────────────────────────
 *
 * Un bloque vacío no se puede dibujar: sin contenido, la línea tiene altura
 * cero y el cursor no cabe. Por eso los navegadores meten un `<br>` al final de
 * cualquier bloque que se quede vacío, y por eso `render.js` añade uno cuando
 * el texto termina en salto de línea. Ese `<br>` es un apaño de dibujo, no un
 * salto de línea: si se leyera como tal, cada vez que el usuario vaciara el
 * editor el modelo acabaría con un `\n` fantasma que se acumula solo.
 *
 * La regla que lo distingue es posicional: **un `<br>` es relleno cuando no
 * queda nada detrás de él dentro de su bloque**. Así, `abc<br>` al final del
 * editor no aporta nada, pero el primer `<br>` de `abc<br><br>` sí, porque
 * detrás tiene otro.
 */

"use strict";

import { normalize } from "./model.js";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Qué estilo aporta cada etiqueta. Se reconocen las que el navegador puede
 *  producir por su cuenta (`<b>`, `<i>`, `<strike>`), no solo las nuestras. */
const STYLE_BY_TAG = {
  STRONG: "bold",
  B: "bold",
  EM: "italic",
  I: "italic",
  U: "underline",
  S: "strikethrough",
  STRIKE: "strikethrough",
  DEL: "strikethrough",
};

/** Etiquetas que empiezan una línea nueva. */
const BLOCK_TAGS = new Set([
  "DIV",
  "P",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TR",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
]);

/**
 * Reconstruye `{ text, ranges }` leyendo el árbol del editor. Es lo que se
 * llama tras teclear, cuando el DOM va por delante del modelo.
 *
 * @param {HTMLElement} root
 * @returns {import("./model.js").Model}
 */
export function readModelFromDom(root) {
  const { text, ranges } = scan(root);
  return normalize({ text, ranges });
}

/**
 * Traduce un punto del DOM —el par `(nodo, offset)` que usan `Range` y
 * `Selection`— a una posición en `model.text`.
 *
 * @param {HTMLElement} root
 * @param {Node} node
 * @param {number} offset
 * @returns {number}
 */
export function domToModelOffset(root, node, offset) {
  if (!node || !root.contains(node)) return 0;
  const { text, targetOffset } = scan(root, { node, offset });
  return targetOffset ?? text.length;
}

/**
 * La inversa: dónde cae un offset del modelo dentro del árbol.
 *
 * Devuelve siempre un punto válido para `Range.setStart`. Si el offset cae en
 * un salto de línea que no vive en ningún nodo de texto —el que aporta un
 * `<div>`— se coloca al principio del texto que viene detrás, que es donde el
 * usuario ve el cursor.
 *
 * @param {HTMLElement} root
 * @param {number} offset
 * @returns {{ node: Node, offset: number }}
 */
export function modelOffsetToDom(root, offset) {
  const { text, entries } = scan(root);
  const target = Math.max(0, Math.min(offset, text.length));

  for (const entry of entries) {
    if (target < entry.start) return { node: entry.node, offset: 0 };
    if (target <= entry.start + entry.length) {
      return { node: entry.node, offset: target - entry.start };
    }
  }

  const last = entries.at(-1);
  return last
    ? { node: last.node, offset: last.length }
    : { node: root, offset: 0 };
}

/**
 * La selección del usuario en offsets del modelo, siempre ordenada. Devuelve
 * `null` si el foco está fuera del editor, que es distinto de "no hay nada
 * seleccionado": quien llama tiene que poder diferenciarlo para no mover el
 * cursor de otro control.
 *
 * @param {HTMLElement} root
 * @returns {{ from: number, to: number } | null}
 */
export function getSelection(root) {
  const view = root.ownerDocument?.defaultView;
  const selection = view?.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;

  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  if (!anchorNode || !focusNode) return null;
  if (!root.contains(anchorNode) || !root.contains(focusNode)) return null;

  const anchor = domToModelOffset(root, anchorNode, anchorOffset);
  const focus = domToModelOffset(root, focusNode, focusOffset);

  return anchor <= focus
    ? { from: anchor, to: focus }
    : { from: focus, to: anchor };
}

/**
 * Coloca la selección. Se llama justo después de repintar, con los offsets
 * guardados antes de hacerlo.
 *
 * @param {HTMLElement} root
 * @param {number} from
 * @param {number} to
 */
export function setSelection(root, from, to) {
  const document_ = root.ownerDocument;
  const selection = document_?.defaultView?.getSelection?.();
  if (!selection) return;

  const start = modelOffsetToDom(root, Math.min(from, to));
  const end = modelOffsetToDom(root, Math.max(from, to));

  try {
    const range = document_.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Un punto imposible no debe dejar el editor inservible: en el peor caso
    // el cursor se queda donde estaba.
  }
}

// ── El recorrido ───────────────────────────────────────────────────────────

/**
 * Recorre el árbol una sola vez y devuelve todo lo que hace falta saber de él:
 * el texto plano, los rangos de estilo, dónde empieza cada nodo de texto y —si
 * se le pasa un punto— a qué offset corresponde.
 *
 * Es una única función porque las cuatro respuestas dependen del mismo
 * recorrido en el mismo orden. Separarlas obligaría a repetirlo y a mantener
 * sincronizadas cuatro copias de las reglas del `<br>` y de los bloques.
 *
 * @param {HTMLElement} root
 * @param {{ node: Node, offset: number }} [target]
 */
function scan(root, target) {
  const state = {
    text: "",
    ranges: [],
    entries: [],
    targetOffset: null,
  };

  visitChildren(root, [], state, root, target);

  return state;
}

function visitChildren(parent, styles, state, root, target) {
  const children = parent.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    markTarget(state, target, parent, index);
    visit(children[index], styles, state, root, target);
  }

  markTarget(state, target, parent, children.length);
}

function visit(node, styles, state, root, target) {
  if (node.nodeType === TEXT_NODE) {
    const data = node.data;
    state.entries.push({ node, start: state.text.length, length: data.length });

    if (target && target.node === node && state.targetOffset === null) {
      state.targetOffset =
        state.text.length + Math.min(Math.max(target.offset, 0), data.length);
    }

    append(state, data, styles);
    return;
  }

  if (node.nodeType !== ELEMENT_NODE) return;

  const tag = node.tagName;

  if (tag === "BR") {
    if (!isFillerBreak(node, root)) append(state, "\n", []);
    return;
  }

  if (BLOCK_TAGS.has(tag) && state.text.length > 0) {
    append(state, "\n", []);
  }

  const style = STYLE_BY_TAG[tag];
  const nested = style && !styles.includes(style) ? [...styles, style] : styles;

  visitChildren(node, nested, state, root, target);
}

function append(state, text, styles) {
  if (text === "") return;

  const start = state.text.length;
  state.text += text;

  for (const style of styles) {
    state.ranges.push({ start, end: start + text.length, style });
  }
}

function markTarget(state, target, parent, index) {
  if (!target || state.targetOffset !== null) return;
  if (target.node !== parent || target.offset !== index) return;
  state.targetOffset = state.text.length;
}

/**
 * ¿Este `<br>` es el relleno de dibujo de un bloque vacío, en vez de un salto
 * de línea real? Lo es cuando no queda nada detrás de él dentro de su bloque.
 *
 * @param {Element} br
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function isFillerBreak(br, root) {
  let node = br;

  while (node && node !== root) {
    for (let sibling = node.nextSibling; sibling; sibling = sibling.nextSibling) {
      if (hasContent(sibling)) return false;
    }

    const parent = node.parentNode;
    if (!parent || parent === root) return true;
    if (BLOCK_TAGS.has(parent.tagName)) return true;
    node = parent;
  }

  return true;
}

function hasContent(node) {
  if (node.nodeType === TEXT_NODE) return node.data.length > 0;
  if (node.nodeType !== ELEMENT_NODE) return false;
  if (node.tagName === "BR") return true;
  return node.textContent.length > 0 || node.querySelector("br") !== null;
}
