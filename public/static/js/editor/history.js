/**
 * PintaPost — deshacer y rehacer (S04, B-10).
 *
 * Dos pilas de instantáneas `{ model, selection }` y nada más. Es corto porque
 * el modelo es un objeto serializable: guardar el estado del editor es guardar
 * el modelo, y volver atrás es volver a pintarlo. Ese es el rédito directo de
 * ADR-003; con un editor que trabajara sobre el texto ya transformado, cada
 * instantánea tendría que reconstruirse a partir del DOM.
 *
 * ── Por qué sustituimos el deshacer del navegador ──────────────────────────
 *
 * El `contenteditable` trae su propio historial, y funciona bien mientras el
 * usuario solo escribe. Pero en cuanto una acción repinta el contenido por
 * código —poner negrita, pegar, alternar una lista—, ese historial queda
 * inservible: el navegador ve una sustitución opaca del árbol y `Ctrl+Z`
 * deshace demasiado o demasiado poco. Así que se intercepta el atajo y se
 * gestiona entero aquí.
 *
 * ── Todo es inmutable ──────────────────────────────────────────────────────
 *
 * Ninguna función muta el historial que recibe: todas devuelven uno nuevo.
 * Cuesta una copia de un array de como mucho 50 referencias y ahorra la clase
 * de error más difícil de encontrar en un editor, la de dos instantáneas que
 * comparten el mismo objeto y cambian a la vez.
 */

"use strict";

/** Cuántos pasos atrás se guardan. */
export const DEFAULT_LIMIT = 50;

/** @typedef {{ model: import("./model.js").Model, selection: { from: number, to: number } }} Snapshot */
/** @typedef {{ past: Snapshot[], future: Snapshot[], limit: number }} History */

/**
 * @param {number} [limit]
 * @returns {History}
 */
export function createHistory(limit = DEFAULT_LIMIT) {
  return { past: [], future: [], limit: Math.max(1, limit) };
}

/**
 * Apila el estado **anterior** a un cambio y descarta lo que hubiera para
 * rehacer.
 *
 * Que se apile el estado de antes y no el de después es lo que hace que la
 * primera pulsación de `Ctrl+Z` deshaga la última acción en vez de no hacer
 * nada. Y vaciar la pila de rehacer es obligatorio: tras deshacer tres pasos y
 * escribir algo nuevo, esos tres futuros describen un texto que ya no existe.
 *
 * @param {History} history
 * @param {Snapshot} snapshot
 * @returns {History}
 */
export function record(history, snapshot) {
  const past = [...history.past, snapshot];
  if (past.length > history.limit) past.shift();
  return { past, future: [], limit: history.limit };
}

/**
 * Deshace. Devuelve `null` si no hay nada que deshacer, para que quien llama
 * distinga "no había pasado" de "el estado no ha cambiado".
 *
 * @param {History} history
 * @param {Snapshot} current estado actual del editor, que pasa a la pila de rehacer
 * @returns {{ history: History, snapshot: Snapshot } | null}
 */
export function undo(history, current) {
  if (history.past.length === 0) return null;

  const past = [...history.past];
  const snapshot = past.pop();

  return {
    history: {
      past,
      future: [...history.future, current],
      limit: history.limit,
    },
    snapshot,
  };
}

/**
 * Rehace. Simétrica de `undo`.
 *
 * @param {History} history
 * @param {Snapshot} current
 * @returns {{ history: History, snapshot: Snapshot } | null}
 */
export function redo(history, current) {
  if (history.future.length === 0) return null;

  const future = [...history.future];
  const snapshot = future.pop();

  return {
    history: {
      past: [...history.past, current],
      future,
      limit: history.limit,
    },
    snapshot,
  };
}

/** @param {History} history */
export function canUndo(history) {
  return history.past.length > 0;
}

/** @param {History} history */
export function canRedo(history) {
  return history.future.length > 0;
}
