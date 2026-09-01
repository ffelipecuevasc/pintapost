/**
 * PintaPost — los comandos del editor (S04, B-08, B-11, B-12).
 *
 * Cada comando toma `(model, selection)` y devuelve `{ model, selection }`
 * nuevos. Son funciones puras: no tocan el DOM, no leen el portapapeles y no
 * saben qué botón las ha llamado. `editor.js` se limita a leer la selección,
 * llamar al comando, renderizar y volver a colocar el cursor.
 *
 * Devolver también la selección no es un detalle: insertar `• ` al principio
 * de tres líneas mueve todo lo que venga detrás, y si el comando no dijera
 * dónde ha quedado el tramo seleccionado, el editor lo restauraría en el sitio
 * equivocado. La regla es que el comando sabe cuánto ha desplazado cada cosa,
 * así que es el comando quien lo dice.
 *
 * ── Las listas son texto, no estructura ────────────────────────────────────
 *
 * LinkedIn no tiene listas. Un post con viñetas es texto plano en el que
 * alguien escribió `• ` al principio de cada línea, y eso es exactamente lo que
 * hacen estos comandos: insertar o quitar un prefijo en las líneas que toca la
 * selección.
 *
 * No hay `<ul>`, ni anidamiento, ni `Enter` que continúe la lista. El modelo se
 * parece a lo que LinkedIn va a recibir, que es el criterio que decide en este
 * proyecto, y de paso desaparece toda la complejidad de serializar estructuras.
 *
 * Las líneas **vacías se saltan**: no reciben prefijo y no cuentan para decidir
 * si la lista ya está puesta. Sin esta regla, una línea en blanco dentro de la
 * selección haría que "todas las líneas ya tienen el prefijo" fuera falso para
 * siempre, y el botón nunca podría desactivar la lista.
 *
 * ── Por qué los prefijos se aplican de la última línea a la primera ────────
 *
 * Los offsets de cada línea se calculan sobre el texto original. En cuanto se
 * inserta el prefijo de la primera línea, los de todas las demás dejan de ser
 * válidos. Recorrer al revés evita recalcular nada: una edición en la línea
 * cinco no mueve el principio de la línea dos.
 *
 * ── Las dos piezas que no son comandos ─────────────────────────────────────
 *
 * `applyStyleSet` y `dropText` viven aquí aunque no las llame ningún botón.
 * Son la parte pura de las dos entradas al editor que no pasan por la barra
 * —escribir con un estilo pendiente (X-31) y soltar texto con el ratón
 * (X-32)—, y están aquí por el mismo motivo que el resto: para que la lógica
 * que se puede equivocar tenga test, y `editor.js` se quede en cablear
 * eventos.
 */

"use strict";

import {
  applyStyle,
  clearStyles,
  deleteRange,
  insertText,
  normalize,
  removeStyle,
  STYLES,
  toggleStyle,
} from "./model.js";
import { stripStyling } from "../format/unicode.js";

/** El prefijo de la lista con viñetas. */
export const BULLET_PREFIX = "• ";

/**
 * Los dos tipos de lista. `match` devuelve cuántos caracteres ocupa el prefijo
 * al principio de la línea, o 0 si no lo lleva.
 */
const BULLET_LIST = {
  match: (line) => (line.startsWith(BULLET_PREFIX) ? BULLET_PREFIX.length : 0),
  prefix: () => BULLET_PREFIX,
};

const NUMBERED_LIST = {
  match: (line) => /^\d+\. /.exec(line)?.[0].length ?? 0,
  prefix: (index) => `${index + 1}. `,
};

/**
 * Alterna un estilo sobre la selección. Con la selección colapsada no hace
 * nada (ver `toggleStyle` en `model.js`).
 *
 * @param {import("./model.js").Model} model
 * @param {{ from: number, to: number }} selection
 * @param {import("./model.js").Style} style
 * @returns {{ model: import("./model.js").Model, selection: { from: number, to: number } }}
 */
export function toggleTextStyle(model, selection, style) {
  const { from, to } = order(selection);
  return {
    model: toggleStyle(model, from, to, style),
    selection: { from, to },
  };
}

/**
 * Limpia el formato de la selección, o de **todo el texto** si no hay nada
 * seleccionado. Es la única forma de vaciar el formato de un post entero sin
 * obligar a seleccionarlo antes, y no destruye nada recuperable: el texto es el
 * mismo, solo se van los rangos.
 *
 * @param {import("./model.js").Model} model
 * @param {{ from: number, to: number }} selection
 * @returns {{ model: import("./model.js").Model, selection: { from: number, to: number } }}
 */
export function clearFormatting(model, selection) {
  const { from, to } = order(selection);
  const todo = from === to;

  return {
    model: todo
      ? clearStyles(model, 0, model.text.length)
      : clearStyles(model, from, to),
    selection: { from, to },
  };
}

/**
 * Alterna el prefijo `• ` en las líneas que toca la selección.
 *
 * @param {import("./model.js").Model} model
 * @param {{ from: number, to: number }} selection
 * @returns {{ model: import("./model.js").Model, selection: { from: number, to: number } }}
 */
export function toggleBulletList(model, selection) {
  return toggleListPrefix(model, selection, BULLET_LIST);
}

/**
 * Alterna el prefijo `1. `, `2. `, `3. `… en las líneas que toca la selección,
 * renumerando el bloque desde uno.
 *
 * Si las líneas ya llevaban viñetas, se sustituyen: alternar entre los dos
 * tipos de lista convierte una en otra en vez de acumular prefijos.
 *
 * @param {import("./model.js").Model} model
 * @param {{ from: number, to: number }} selection
 * @returns {{ model: import("./model.js").Model, selection: { from: number, to: number } }}
 */
export function toggleNumberedList(model, selection) {
  return toggleListPrefix(model, selection, NUMBERED_LIST);
}

/**
 * Inserta texto plano en la posición del cursor, reemplazando la selección si
 * la hay. El cursor queda al final de lo insertado, como tras pegar en
 * cualquier otro editor.
 *
 * @param {import("./model.js").Model} model
 * @param {{ from: number, to: number }} selection
 * @param {string} text
 * @returns {{ model: import("./model.js").Model, selection: { from: number, to: number } }}
 */
export function insertPlainText(model, selection, text) {
  const { from, to } = order(selection);

  let result = from === to ? normalize(model) : deleteRange(model, from, to);
  result = insertText(result, from, text);

  const caret = from + text.length;
  return { model: result, selection: { from: caret, to: caret } };
}

/**
 * Deja el texto del portapapeles listo para entrar en el modelo (B-11).
 *
 * 1. Unifica los saltos de línea: `\r\n` y `\r` sueltos pasan a `\n`. Windows y
 *    los editores antiguos siguen produciendo los dos, y un `\r` dentro del
 *    modelo se vería como un salto de línea que no está en `text.length`.
 * 2. Pasa el resultado por `stripStyling`, que devuelve a letras normales
 *    cualquier carácter del bloque matemático.
 *
 * El segundo paso es el que cumple ADR-003 en la frontera más peligrosa del
 * editor: pegar desde otro formateador de LinkedIn mete texto ya convertido a
 * Unicode, y sin limpiarlo entraría tal cual en `model.text`. `stripStyling`
 * reconoce las catorce familias del bloque, no solo la sans-serif que produce
 * este motor, así que también limpia lo que viene de herramientas ajenas.
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanPastedText(text) {
  return stripStyling(text.replace(/\r\n?/g, "\n"));
}

/**
 * Deja el tramo `[from, to)` con **exactamente** estos estilos: aplica los que
 * están en la lista y quita los que no. Es la parte pura del estilo pendiente
 * (X-31).
 *
 * Que quite y no solo añada es lo que hace falta para el caso simétrico:
 * con el cursor dentro de una palabra en negrita, pulsar negrita significa que
 * lo siguiente que escriba salga **sin** negrita, y `insertText` la habría
 * heredado por estar la posición dentro del rango.
 *
 * @param {import("./model.js").Model} model
 * @param {number} from
 * @param {number} to
 * @param {Iterable<import("./model.js").Style>} styles
 * @returns {import("./model.js").Model}
 */
export function applyStyleSet(model, from, to, styles) {
  const wanted = new Set(styles);

  let result = model;
  for (const style of STYLES) {
    result = wanted.has(style)
      ? applyStyle(result, from, to, style)
      : removeStyle(result, from, to, style);
  }
  return result;
}

/**
 * Inserta texto soltado con el ratón en la posición `at` (X-32).
 *
 * Con `source`, el gesto es **mover**, no copiar: el texto venía de dentro del
 * propio editor y hay que borrarlo de su sitio. Es la diferencia entre esto y
 * `insertPlainText`, y el motivo de que no baste con reutilizar el pegado tal
 * cual: interceptar `drop` le quita al navegador el borrado del origen, que
 * hacía él solo, y sin devolvérselo arrastrar dentro del editor duplicaría el
 * texto en vez de moverlo.
 *
 * Soltar **dentro del propio tramo arrastrado** no hace nada, que es lo que
 * hacen los navegadores: no hay ningún sitio nuevo al que llevarlo.
 *
 * @param {import("./model.js").Model} model
 * @param {number} at posición de la caída
 * @param {string} text ya limpio, ver `cleanPastedText`
 * @param {{ from: number, to: number } | null} [source] tramo de origen si el
 *   arrastre empezó dentro del editor
 * @returns {{ model: import("./model.js").Model, selection: { from: number, to: number } }}
 */
export function dropText(model, at, text, source = null) {
  const position = Math.max(0, Math.min(at, model.text.length));

  if (!source || source.from === source.to) {
    return insertPlainText(model, { from: position, to: position }, text);
  }

  const { from, to } = order(source);
  if (position > from && position < to) {
    return { model: normalize(model), selection: { from, to } };
  }

  // El destino se calcula **antes** de borrar y se corrige después: si el
  // origen estaba delante, todo lo que venía detrás se ha movido hacia la
  // izquierda tantas posiciones como caracteres se han quitado.
  const target = position >= to ? position - (to - from) : position;

  return insertPlainText(
    deleteRange(model, from, to),
    { from: target, to: target },
    text,
  );
}

// ── Listas ─────────────────────────────────────────────────────────────────

/**
 * El motor de las dos listas. Decide si toca poner o quitar, calcula una
 * edición por línea y las aplica de la última a la primera.
 *
 * @param {import("./model.js").Model} model
 * @param {{ from: number, to: number }} selection
 * @param {{ match: (line: string) => number, prefix: (index: number) => string }} kind
 */
function toggleListPrefix(model, selection, kind) {
  const { from, to } = order(selection);
  const lines = linesTouchedBy(model.text, from, to).filter(
    (line) => line.end > line.start,
  );

  if (lines.length === 0) {
    return { model: normalize(model), selection: { from, to } };
  }

  const contents = lines.map((line) => model.text.slice(line.start, line.end));
  const yaEstaPuesta = contents.every((line) => kind.match(line) > 0);

  // Las ediciones se calculan de arriba abajo —la numeración necesita el orden
  // de la línea— y se aplican al revés.
  const edits = lines.map((line, index) => ({
    at: line.start,
    remove: yaEstaPuesta
      ? kind.match(contents[index])
      : anyListPrefixLength(contents[index]),
    insert: yaEstaPuesta ? "" : kind.prefix(index),
  }));

  let result = model;
  let caret = { from, to };

  for (const edit of edits.reverse()) {
    if (edit.remove > 0) {
      result = deleteRange(result, edit.at, edit.at + edit.remove);
      caret = shiftAfterDelete(caret, edit.at, edit.remove);
    }
    if (edit.insert !== "") {
      result = insertText(result, edit.at, edit.insert);
      caret = shiftAfterInsert(caret, edit.at, edit.insert.length);
    }
  }

  return { model: result, selection: caret };
}

/**
 * Cuánto ocupa el prefijo de lista de esta línea, sea del tipo que sea. Se usa
 * al poner una lista: si la línea ya era del otro tipo, su prefijo se sustituye
 * en vez de acumularse.
 *
 * @param {string} line
 * @returns {number}
 */
function anyListPrefixLength(line) {
  return Math.max(BULLET_LIST.match(line), NUMBERED_LIST.match(line));
}

/**
 * Las líneas que toca el tramo `[from, to)`, como offsets `{ start, end }` sin
 * incluir el `\n` final.
 *
 * Con la selección colapsada devuelve la línea del cursor. Con una selección
 * de verdad, una que termine justo en el principio de la línea siguiente **no**
 * la incluye: seleccionar hasta el salto de línea es seleccionar la línea de
 * arriba, no las dos.
 *
 * @param {string} text
 * @param {number} from
 * @param {number} to
 * @returns {{ start: number, end: number }[]}
 */
function linesTouchedBy(text, from, to) {
  const lines = [];
  let start = 0;

  while (start <= text.length) {
    const salto = text.indexOf("\n", start);
    const end = salto === -1 ? text.length : salto;
    lines.push({ start, end });
    if (salto === -1) break;
    start = salto + 1;
  }

  return lines.filter((line) =>
    from === to
      ? line.start <= from && from <= line.end
      : line.start < to && line.end >= from,
  );
}

// ── Auxiliares ─────────────────────────────────────────────────────────────

function order(selection) {
  const a = Math.max(0, selection?.from ?? 0);
  const b = Math.max(0, selection?.to ?? 0);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/**
 * Desplaza la selección tras insertar `length` caracteres en `at`. Un extremo
 * que estaba justo en `at` se mueve hacia la derecha: así la selección sigue
 * cubriendo el mismo texto y deja fuera el prefijo recién puesto.
 */
function shiftAfterInsert(selection, at, length) {
  const move = (position) => (position >= at ? position + length : position);
  return { from: move(selection.from), to: move(selection.to) };
}

/** Desplaza la selección tras borrar `length` caracteres desde `at`. */
function shiftAfterDelete(selection, at, length) {
  const move = (position) => {
    if (position <= at) return position;
    if (position >= at + length) return position - length;
    return at;
  };
  return { from: move(selection.from), to: move(selection.to) };
}
