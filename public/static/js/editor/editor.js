/**
 * PintaPost — el controlador del editor (S04, B-06 a B-12).
 *
 * El único archivo del editor que toca el DOM de verdad: escucha los eventos
 * del `contenteditable`, decide qué hacer con cada uno y reparte el trabajo
 * entre las piezas puras (`model`, `render`, `commands`, `history`) y el puente
 * de posiciones (`selection`).
 *
 * ── Las dos direcciones del flujo ──────────────────────────────────────────
 *
 * Es la idea que gobierna todo el archivo, y la razón de que exista en vez de
 * ser cuatro líneas de cableado:
 *
 *   El usuario teclea        DOM → modelo      NO se re-renderiza
 *   Negrita, listas, limpiar modelo → DOM      sí
 *   Pegar                    modelo → DOM      sí
 *   Deshacer / rehacer       modelo → DOM      sí
 *
 * Al teclear, el navegador ya hace exactamente lo que hay que hacer: inserta el
 * carácter, mueve el cursor y mantiene abierta la composición de una tecla
 * muerta. Repintar en ese momento destruiría los nodos de texto sobre los que
 * está trabajando, y el resultado es el cursor al principio y el acento
 * perdido. Así que se le deja escribir y después se **lee** el resultado con
 * `readModelFromDom`.
 *
 * Poner negrita es el caso contrario: no existe ninguna pulsación que
 * signifique «los caracteres 5 a 12 pasan a estar en negrita». El cambio nace
 * en el modelo y puede reorganizar el árbol entero —poner negrita sobre un
 * tramo ya en cursiva parte segmentos y anida etiquetas nuevas—, así que hay
 * que repintar. Y como repintar destruye la selección, el orden de un comando
 * es siempre el mismo y no admite variaciones:
 *
 *   guardar la selección → mutar el modelo → renderizar → restaurarla
 *
 * Funciona porque los offsets del modelo sobreviven al repintado aunque los
 * nodos del DOM no.
 *
 * ── La regla práctica ──────────────────────────────────────────────────────
 *
 * Si el `contenteditable` da guerra, casi nunca se arregla añadiendo un
 * re-renderizado más. Se arregla comprobando si se está repintando donde
 * habría que estar leyendo.
 */

"use strict";

import { createModel, hasStyle, STYLES } from "./model.js";
import { render } from "./render.js";
import { getSelection, readModelFromDom, setSelection } from "./selection.js";
import {
  cleanPastedText,
  clearFormatting,
  insertPlainText,
  toggleBulletList,
  toggleNumberedList,
  toggleTextStyle,
} from "./commands.js";
import { createHistory, record, redo, undo } from "./history.js";
import { stripStyling } from "../format/unicode.js";

/**
 * Cuánto se espera desde la última tecla para dar por cerrada una ráfaga de
 * escritura. Media palabra escrita del tirón es un solo paso de deshacer;
 * escribir, pensar un segundo y seguir, son dos.
 */
const TYPING_PAUSE_MS = 500;

/**
 * `selectionchange` se dispara con cada movimiento del cursor, también mientras
 * se arrastra para seleccionar. Sin este respiro la barra de herramientas
 * parpadearía durante el arrastre.
 */
const SELECTION_DEBOUNCE_MS = 50;

/** El bloque prohibido dentro del modelo: Mathematical Alphanumeric Symbols. */
const MATH_ALPHANUMERIC = /[\u{1D400}-\u{1D7FF}]/u;

/** Qué comando ejecuta cada botón de la barra. Todos son `(model, selection)`. */
const COMMANDS = {
  bold: (model, selection) => toggleTextStyle(model, selection, "bold"),
  italic: (model, selection) => toggleTextStyle(model, selection, "italic"),
  underline: (model, selection) => toggleTextStyle(model, selection, "underline"),
  strikethrough: (model, selection) =>
    toggleTextStyle(model, selection, "strikethrough"),
  bullet: toggleBulletList,
  numbered: toggleNumberedList,
  clear: clearFormatting,
};

/** Los atajos que hay que arrebatarle al navegador. Ver `handleKeydown`. */
const SHORTCUTS = { b: "bold", i: "italic", u: "underline" };

/**
 * Arranca el editor sobre un `contenteditable`.
 *
 * @param {HTMLElement} root el elemento editable
 * @param {{ toolbar?: HTMLElement }} [options]
 * @returns {{ getModel: () => import("./model.js").Model,
 *             setModel: (model: import("./model.js").Model) => void,
 *             execute: (command: string) => void,
 *             focus: () => void }}
 */
export function createEditor(root, options = {}) {
  const toolbar = options.toolbar ?? null;

  let model = readModelFromDom(root);
  let history = createHistory();

  /** ¿Hay una composición de tecla muerta abierta? Ver `handleComposition`. */
  let composing = false;

  /** Temporizador de la ráfaga de escritura. `null` = no hay ráfaga abierta. */
  let typingTimer = null;

  /** Estado justo antes del cambio en curso, capturado en `beforeinput`. */
  let pending = null;

  let selectionTimer = null;

  /** La última selección buena que hubo dentro del editor. Ver `currentSelection`. */
  let lastSelection = null;

  // ── Pintar y leer ────────────────────────────────────────────────────────

  /** Modelo → DOM. El único sitio del editor que asigna `innerHTML`. */
  function paint() {
    root.innerHTML = render(model);
    syncPlaceholder();
  }

  /**
   * DOM → modelo. Lo que se llama tras teclear, cuando el DOM va por delante.
   * No repinta: ese es justamente el motivo de que exista.
   */
  function readFromDom() {
    model = readModelFromDom(root);

    // El estado previo se consume aquí y no sobrevive al cambio. Si en algún
    // navegador `beforeinput` no llegara a dispararse, la siguiente ráfaga
    // apilaría un modelo viejo —el de dos cambios atrás— y el deshacer
    // resucitaría texto que el usuario ya había borrado. Vale más perder la
    // posición exacta del cursor que apilar un estado equivocado.
    pending = null;

    guardAgainstStyledText();
    syncPlaceholder();
    announceChange();
    scheduleToolbarSync();
  }

  /**
   * El marcador de posición (S02) no puede depender de `:empty`: al escribir y
   * borrar, el navegador deja dentro un `<br>` residual y el selector deja de
   * casar para siempre. `textContent` sí lo ignora.
   */
  function syncPlaceholder() {
    root.classList.toggle("is-empty", root.textContent.trim() === "");
  }

  /** Avisa a quien quiera enterarse —el contador del S05— sin acoplarse. */
  function announceChange() {
    root.dispatchEvent(
      new CustomEvent("pintapost:change", {
        detail: { model },
        bubbles: true,
      }),
    );
  }

  // ── Ejecutar un comando: la dirección modelo → DOM ───────────────────────

  /**
   * El orden de estos cinco pasos no es negociable; está explicado en la
   * cabecera. La selección se lee **antes** de tocar nada y se restaura
   * **después** de repintar, con los offsets que el propio comando devuelve:
   * insertar `• ` en tres líneas mueve todo lo que viene detrás, y solo el
   * comando sabe cuánto.
   *
   * @param {(model: import("./model.js").Model,
   *          selection: { from: number, to: number })
   *         => { model: import("./model.js").Model,
   *              selection: { from: number, to: number } }} command
   */
  function apply(command) {
    const selection = currentSelection();
    endTypingBurst();

    const result = command(model, selection);

    // Un comando que no cambia nada no gasta un paso de deshacer. Sin esto,
    // pulsar negrita con el cursor colapsado —donde `toggleStyle` no hace nada
    // a propósito— dejaría en la pila una entrada idéntica a la actual, y el
    // siguiente `Ctrl+Z` parecería no funcionar.
    if (sameModel(result.model, model)) {
      syncToolbar();
      return;
    }

    history = record(history, { model, selection });
    model = result.model;

    guardAgainstStyledText();
    paint();
    setSelection(root, result.selection.from, result.selection.to);

    announceChange();
    syncToolbar();
  }

  /**
   * Ejecuta un comando de la barra por su nombre. Devuelve el foco al editor:
   * tras poner negrita, lo natural es seguir escribiendo.
   *
   * @param {string} name
   */
  function execute(name) {
    const command = COMMANDS[name];
    if (!command) return;

    apply(command);
    root.focus();
  }

  /**
   * La selección sobre la que trabajan los comandos.
   *
   * El caso incómodo es pulsar un botón de la barra: el foco se va al botón y
   * el navegador puede colapsar la selección del editor justo antes de que el
   * comando llegue a leerla. Hay dos defensas y hacen falta las dos:
   *
   * - Para el ratón, `mousedown` cancelado en la barra, más abajo. El foco no
   *   llega a salir del editor y esto ni se nota.
   * - Para el teclado —tabular hasta el botón y pulsar Espacio—, el foco sí
   *   sale, así que se recuerda la última selección buena que hubo dentro.
   *
   * El recuerdo se recorta contra el texto de ahora: entre que se guardó y se
   * usa puede haber pasado un deshacer que acorte el texto.
   */
  function currentSelection() {
    const selection = getSelection(root);
    if (selection) {
      lastSelection = selection;
      return selection;
    }

    const limit = model.text.length;
    if (!lastSelection) return { from: limit, to: limit };

    return {
      from: Math.min(lastSelection.from, limit),
      to: Math.min(lastSelection.to, limit),
    };
  }

  // ── Historial ────────────────────────────────────────────────────────────

  /**
   * Abre una ráfaga de escritura si no había ninguna, apilando el estado
   * **anterior** a la primera tecla. Las siguientes teclas de la misma ráfaga
   * solo estiran el temporizador, que es lo que evita guardar letra por letra.
   */
  function beginTypingBurst() {
    if (typingTimer === null) {
      history = record(history, pending ?? { model, selection: currentSelection() });
    }
    if (typingTimer !== null) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingTimer = null;
    }, TYPING_PAUSE_MS);
  }

  /**
   * Cierra la ráfaga abierta sin apilar nada más. Se llama antes de cualquier
   * acción que no sea teclear: si no, escribir «hola», pulsar negrita y
   * deshacer dejaría el estilo quitado pero la ráfaga de «hola» todavía viva,
   * y el siguiente carácter no abriría paso nuevo.
   */
  function endTypingBurst() {
    if (typingTimer !== null) clearTimeout(typingTimer);
    typingTimer = null;
    pending = null;
  }

  /**
   * Restaura una instantánea del historial. Repinta siempre: deshacer es, por
   * definición, un cambio que no nace del teclado.
   *
   * @param {{ history: import("./history.js").History,
   *           snapshot: { model: import("./model.js").Model,
   *                       selection: { from: number, to: number } } } | null} step
   */
  function restore(step) {
    if (!step) return;

    history = step.history;
    model = step.snapshot.model;

    paint();
    setSelection(root, step.snapshot.selection.from, step.snapshot.selection.to);

    announceChange();
    syncToolbar();
  }

  function undoStep() {
    endTypingBurst();
    restore(undo(history, { model, selection: currentSelection() }));
  }

  function redoStep() {
    endTypingBurst();
    restore(redo(history, { model, selection: currentSelection() }));
  }

  // ── La guardia de ADR-003 ───────────────────────────────────────────────

  /**
   * `model.text` no puede contener ni un carácter del bloque matemático. Es la
   * decisión central del proyecto (ADR-003) y la única forma de que el cursor,
   * el borrado y la accesibilidad dentro del editor sigan siendo los del
   * navegador.
   *
   * Las dos entradas conocidas están tapadas —el pegado pasa por
   * `cleanPastedText` y el teclado no produce estos caracteres—, así que si
   * esto salta es que hay una tercera: arrastrar y soltar texto de otra
   * pestaña es la candidata, y un `execCommand` ajeno la otra.
   *
   * Por eso no se limita a avisar: **repara**. Un aviso en consola no le sirve
   * de nada al usuario que acaba de soltar un párrafo ya convertido, y dejarlo
   * entrar contamina el modelo para el resto de la sesión.
   */
  function guardAgainstStyledText() {
    if (!MATH_ALPHANUMERIC.test(model.text)) return;

    console.error(
      "[PintaPost] ADR-003: el modelo contenía caracteres del bloque " +
        "matemático y se han limpiado. Algo ha metido texto ya estilizado.",
    );

    // Los rangos se recortan solos: `stripStyling` solo acorta el texto y
    // `createModel` normaliza contra la nueva longitud. La correspondencia
    // exacta se pierde, y es un precio razonable en una rama que no debería
    // ejecutarse nunca.
    const caret = getSelection(root)?.to ?? model.text.length;
    model = createModel(stripStyling(model.text), model.ranges);

    paint();
    const at = Math.min(caret, model.text.length);
    setSelection(root, at, at);
  }

  // ── La barra de herramientas ────────────────────────────────────────────

  /**
   * Refleja en los botones lo que tiene la selección. `aria-pressed` lleva el
   * estado que anuncia el lector de pantalla, y `data-state` el tercer valor
   * que ARIA no tiene: `partial`, media selección con el estilo puesto.
   */
  function syncToolbar() {
    if (!toolbar) return;

    const { from, to } = currentSelection();

    for (const style of STYLES) {
      const button = toolbar.querySelector(`[data-command="${style}"]`);
      if (!button) continue;

      const state = hasStyle(model, from, to, style);
      button.setAttribute("aria-pressed", state === "none" ? "false" : "true");
      button.dataset.state = state;
    }
  }

  function scheduleToolbarSync() {
    if (selectionTimer !== null) clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      selectionTimer = null;
      syncToolbar();
    }, SELECTION_DEBOUNCE_MS);
  }

  // ── Los eventos ─────────────────────────────────────────────────────────

  /**
   * `beforeinput` llega **antes** de que el navegador toque el DOM, y es el
   * único momento en que se puede leer dónde estaba el cursor antes del cambio.
   * Sin esto, deshacer una ráfaga de escritura devolvería el texto correcto
   * pero con el cursor donde acabó, no donde empezó.
   */
  function handleBeforeInput() {
    if (composing) return;
    pending = { model, selection: currentSelection() };
  }

  function handleInput() {
    // Durante una composición el texto todavía no está decidido: leerlo aquí
    // guardaría estados intermedios («´» suelto) en el modelo y en el
    // historial. Se lee entero en `compositionend`.
    if (composing) return;

    beginTypingBurst();
    readFromDom();
  }

  /**
   * Escribir `á` con tecla muerta en un teclado español son dos pulsaciones que
   * el navegador mantiene abiertas como una sola composición. Entre
   * `compositionstart` y `compositionend` **no se toca el DOM**: si el editor
   * repinta a mitad, el acento se pierde o se duplica. Es también el camino de
   * los teclados predictivos de Android.
   */
  function handleCompositionStart() {
    composing = true;
    pending = { model, selection: currentSelection() };
  }

  function handleCompositionEnd() {
    composing = false;
    beginTypingBurst();
    readFromDom();
  }

  /**
   * Pegado limpio (B-11). Nunca `text/html`: lo que llega de Word o de Google
   * Docs trae hojas de estilo enteras, y lo que llega de otro formateador de
   * LinkedIn trae texto ya convertido a Unicode matemático, que es justo lo
   * que ADR-003 prohíbe. `cleanPastedText` resuelve las dos cosas.
   *
   * @param {ClipboardEvent} event
   */
  function handlePaste(event) {
    event.preventDefault();

    const raw = event.clipboardData?.getData("text/plain") ?? "";
    const text = cleanPastedText(raw);
    if (text === "") return;

    apply((current, selection) => insertPlainText(current, selection, text));
  }

  /**
   * Los atajos. Todos con `preventDefault()`, y por dos motivos distintos:
   *
   * - `Ctrl+B/I/U`: el navegador tiene los suyos y meterían `<b>` en el DOM
   *   por su cuenta, saltándose el modelo.
   * - `Ctrl+Z`: el historial nativo queda inservible en cuanto repintamos el
   *   contenido por código, así que lo sustituimos entero (ver `history.js`).
   *
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    const meta = event.ctrlKey || event.metaKey;
    if (!meta || event.altKey) return;

    const key = event.key.toLowerCase();

    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redoStep();
      else undoStep();
      return;
    }

    // Ctrl+Y es el rehacer de Windows. En macOS no existe y Cmd+Y está
    // ocupado por el sistema, pero comprobar `metaKey` aquí no estorba.
    if (key === "y") {
      event.preventDefault();
      redoStep();
      return;
    }

    const style = SHORTCUTS[key];
    if (!style) return;

    event.preventDefault();
    apply((current, selection) => toggleTextStyle(current, selection, style));
  }

  /**
   * `selectionchange` solo existe en `document`, no en el elemento. Se filtra
   * comprobando que el foco siga dentro para no repintar la barra cuando el
   * usuario selecciona texto de otra parte de la página.
   */
  function handleSelectionChange() {
    // `contains` es cierto también para el propio elemento, que es el caso
    // normal: el foco vive en el `contenteditable`, no en sus hijos.
    if (!root.contains(root.ownerDocument.activeElement)) return;
    scheduleToolbarSync();
  }

  // ── Cableado ────────────────────────────────────────────────────────────

  root.addEventListener("beforeinput", handleBeforeInput);
  root.addEventListener("input", handleInput);
  root.addEventListener("compositionstart", handleCompositionStart);
  root.addEventListener("compositionend", handleCompositionEnd);
  root.addEventListener("paste", handlePaste);
  root.addEventListener("keydown", handleKeydown);
  root.ownerDocument.addEventListener("selectionchange", handleSelectionChange);

  if (toolbar) {
    // El foco no debe salir del editor al pulsar con el ratón: si sale, el
    // navegador colapsa la selección y el comando se aplica sobre nada. Cancelar
    // `mousedown` lo evita sin impedir el `click`, que sigue llegando.
    toolbar.addEventListener("mousedown", (event) => {
      if (event.target.closest("[data-command]")) event.preventDefault();
    });

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-command]");
      if (!button) return;
      event.preventDefault();
      execute(button.dataset.command);
    });
  }

  syncPlaceholder();
  syncToolbar();

  return {
    getModel: () => model,
    setModel: (next) => {
      endTypingBurst();
      model = createModel(next.text, next.ranges);
      guardAgainstStyledText();
      paint();
      announceChange();
      syncToolbar();
    },
    execute,
    focus: () => root.focus(),
  };
}

/**
 * ¿Este texto lleva algún carácter del bloque matemático? Expuesta aparte para
 * que la comprobación de ADR-003 se pueda usar desde los tests y desde la
 * consola sin arrancar un editor.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function containsStyledText(text) {
  return MATH_ALPHANUMERIC.test(text);
}

/**
 * ¿Son el mismo modelo? Basta comparar campo a campo porque `normalize` deja
 * los rangos en forma canónica —ordenados, fusionados y sin vacíos—, así que
 * dos modelos equivalentes son literalmente idénticos.
 *
 * @param {import("./model.js").Model} a
 * @param {import("./model.js").Model} b
 * @returns {boolean}
 */
function sameModel(a, b) {
  if (a.text !== b.text) return false;
  if (a.ranges.length !== b.ranges.length) return false;

  return a.ranges.every((range, index) => {
    const other = b.ranges[index];
    return (
      range.start === other.start &&
      range.end === other.end &&
      range.style === other.style
    );
  });
}
