/**
 * PintaPost — el modelo del editor (S04, B-06).
 *
 * La fuente de verdad de todo lo que el usuario escribe:
 *
 *   { text: "Hola mundo", ranges: [ { start: 0, end: 4, style: "bold" } ] }
 *
 * `text` es texto latino normal. Nunca contiene caracteres del bloque
 * matemático: la conversión a Unicode ocurre solo al copiar (ADR-003). El
 * estilo vive aparte, como una lista de tramos, y se muestra en pantalla con
 * CSS real.
 *
 * Todas las funciones de este archivo son **puras**: no tocan el DOM, no mutan
 * sus argumentos y devuelven un modelo nuevo. Se pueden probar sin navegador y
 * son el cimiento sobre el que se apoyan `render.js`, `commands.js` e
 * `history.js`; por eso van primero y por eso llevan los tests más densos del
 * sprint.
 *
 * ── Los offsets van en unidades UTF-16 ─────────────────────────────────────
 *
 * `start` y `end` se miden como los mide `String.prototype.length`, no en
 * codepoints (ADR-019). El motivo es que la API `Range` del DOM habla ese
 * idioma dentro de los nodos de texto, y `selection.js` traduce entre los dos
 * mundos en cada pulsación: convertir de unidad a codepoint en cada frontera
 * multiplicaría por dos los sitios donde equivocarse, a cambio de nada.
 *
 * El riesgo teórico —colocar un offset en mitad de un par subrogado— no se
 * materializa aquí: el editor solo contiene texto latino normal, los pares
 * subrogados aparecen únicamente en emojis, y ningún navegador deja poner el
 * cursor dentro de uno.
 *
 * ── Un rango por estilo, nunca un estilo combinado ─────────────────────────
 *
 * Un carácter en negrita y cursiva pertenece a **dos rangos distintos**, uno
 * `bold` y otro `italic`, no a un rango con dos banderas. Así aplicar o quitar
 * un estilo es una operación sobre los rangos de ese estilo y solo de ese
 * estilo, sin tocar los demás. La alternativa —un rango con
 * `{ bold, italic, … }`— obligaría a partir y recomponer rangos cada vez que
 * cualquiera de las cuatro banderas cambia en cualquier posición.
 *
 * El precio es que quien quiera pintar el texto tiene que cruzar las cuatro
 * listas para saber qué estilos coinciden en cada tramo. Eso lo hace
 * `render.js`, una vez, y es un recorrido de fronteras trivial.
 *
 * ── `normalize` corre al final de cada operación ───────────────────────────
 *
 * Sin normalizar, poner negrita tres veces sobre tramos contiguos deja tres
 * rangos donde debería haber uno, borrar texto deja rangos vacíos, y comparar
 * dos modelos equivalentes da distinto. La basura no rompe nada de inmediato,
 * pero vuelve el modelo ilegible al depurar y hace que la pila de deshacer
 * guarde instantáneas que solo se diferencian en ruido.
 *
 * La regla es que **ninguna función exportada devuelve un modelo sin
 * normalizar**, así que fuera de este archivo no hace falta acordarse de
 * llamarla.
 */

"use strict";

/**
 * Los cuatro estilos, en el orden en que se emiten y se muestran. El orden es
 * estable a propósito: `normalize` ordena por él, así que dos modelos
 * equivalentes son idénticos al compararlos campo a campo, que es lo que
 * permite contrastar instantáneas del historial con `deepEqual`.
 */
export const STYLES = ["bold", "italic", "underline", "strikethrough"];

/** @typedef {"bold" | "italic" | "underline" | "strikethrough"} Style */
/** @typedef {{ start: number, end: number, style: Style }} Range */
/** @typedef {{ text: string, ranges: Range[] }} Model */

/**
 * Crea un modelo normalizado. Es la única forma recomendada de fabricar uno a
 * mano: acepta rangos desordenados, solapados o fuera de límites y los deja en
 * forma canónica.
 *
 * @param {string} [text]
 * @param {Range[]} [ranges]
 * @returns {Model}
 */
export function createModel(text = "", ranges = []) {
  return normalize({ text, ranges });
}

/**
 * Deja el modelo en forma canónica:
 *
 * 1. Recorta los rangos a los límites del texto y descarta los vacíos.
 * 2. Descarta los estilos desconocidos.
 * 3. Fusiona los rangos del mismo estilo que se solapan **o que se tocan**.
 * 4. Ordena por `start`, y a igualdad por el orden de `STYLES`.
 *
 * Que se fusionen los que se tocan (el `end` de uno igual al `start` del
 * siguiente) no es cosmético: dos rangos `bold` de 0–4 y 4–8 describen
 * exactamente el mismo texto en negrita que uno de 0–8, y si no se unifican,
 * `hasStyle` sobre 2–6 tendría que razonar sobre una frontera que no existe en
 * pantalla.
 *
 * @param {Model} model
 * @returns {Model}
 */
export function normalize(model) {
  const text = model.text ?? "";
  const limit = text.length;
  const merged = [];

  for (const style of STYLES) {
    const sameStyle = (model.ranges ?? [])
      .filter((range) => range.style === style)
      .map((range) => ({
        start: clamp(range.start, 0, limit),
        end: clamp(range.end, 0, limit),
      }))
      .filter((range) => range.start < range.end)
      .sort((a, b) => a.start - b.start);

    let current = null;
    for (const range of sameStyle) {
      if (current && range.start <= current.end) {
        // Se solapan o se tocan: estirar el que ya teníamos.
        current.end = Math.max(current.end, range.end);
        continue;
      }
      current = { start: range.start, end: range.end, style };
      merged.push(current);
    }
  }

  merged.sort(
    (a, b) =>
      a.start - b.start ||
      STYLES.indexOf(a.style) - STYLES.indexOf(b.style) ||
      a.end - b.end,
  );

  return { text, ranges: merged };
}

/**
 * Aplica un estilo al tramo `[from, to)`. Si ya lo tenía en parte, el
 * resultado es un solo rango continuo: de eso se encarga `normalize`.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @param {Style} style
 * @returns {Model}
 */
export function applyStyle(model, from, to, style) {
  const [start, end] = order(from, to);
  if (start === end || !STYLES.includes(style)) return normalize(model);

  return normalize({
    text: model.text,
    ranges: [...model.ranges, { start, end, style }],
  });
}

/**
 * Quita un estilo del tramo `[from, to)`. Un rango que lo contenga por completo
 * se parte en dos: quitar la negrita del centro de una palabra en negrita deja
 * el principio y el final en negrita, que es lo que espera cualquiera.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @param {Style} style
 * @returns {Model}
 */
export function removeStyle(model, from, to, style) {
  const [start, end] = order(from, to);
  if (start === end) return normalize(model);

  const ranges = [];
  for (const range of model.ranges) {
    if (range.style !== style) {
      ranges.push(range);
      continue;
    }
    ranges.push(...subtract(range, start, end));
  }

  return normalize({ text: model.text, ranges });
}

/**
 * Alterna un estilo sobre el tramo: lo quita si **todo** el tramo lo tiene ya,
 * y lo aplica en cualquier otro caso.
 *
 * El caso interesante es `partial`. Con media selección en negrita, un botón
 * que se limitara a invertir dejaría el tramo peor de lo que estaba: la mitad
 * sin negrita y la otra mitad con ella, al revés. Todos los procesadores de
 * texto resuelven esto igual —completar antes que invertir— y es lo que la
 * gente espera sin tener que pensarlo.
 *
 * Con la selección colapsada (`from === to`) no hace nada: no hay caracteres a
 * los que aplicar el estilo. El "estilo pendiente" que se activa antes de
 * escribir queda fuera del alcance del S04 y está anotado en el backlog.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @param {Style} style
 * @returns {Model}
 */
export function toggleStyle(model, from, to, style) {
  const [start, end] = order(from, to);
  if (start === end) return normalize(model);

  return hasStyle(model, start, end, style) === "all"
    ? removeStyle(model, start, end, style)
    : applyStyle(model, start, end, style);
}

/**
 * ¿El tramo `[from, to)` tiene este estilo?
 *
 *   "none"     ni un solo carácter lo tiene
 *   "partial"  algunos sí y otros no
 *   "all"      todo el tramo lo tiene
 *
 * Lo usan `toggleStyle` para decidir y la barra de herramientas para el estado
 * de los botones, donde `partial` se pinta como tercer estado.
 *
 * Con la selección colapsada devuelve el estilo del carácter que queda a la
 * **izquierda** del cursor (`start < pos <= end`), nunca `partial`. Es la
 * convención de los procesadores de texto: al colocar el cursor justo detrás
 * de una palabra en negrita, el botón se ve activo.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @param {Style} style
 * @returns {"none" | "partial" | "all"}
 */
export function hasStyle(model, from, to, style) {
  const [start, end] = order(from, to);
  const sameStyle = model.ranges.filter((range) => range.style === style);

  if (start === end) {
    const active = sameStyle.some(
      (range) => range.start < start && start <= range.end,
    );
    return active ? "all" : "none";
  }

  // Recorrer el tramo saltando de rango en rango: si en algún punto no hay
  // ninguno que cubra la posición, queda un hueco. Los rangos vienen
  // normalizados —ordenados y sin solapes— así que basta una pasada.
  let covered = 0;
  let cursor = start;
  for (const range of sameStyle) {
    if (range.end <= cursor) continue;
    if (range.start >= end) break;
    if (range.start > cursor) cursor = range.start;
    const until = Math.min(range.end, end);
    if (until > cursor) {
      covered += until - cursor;
      cursor = until;
    }
  }

  if (covered === 0) return "none";
  return covered === end - start ? "all" : "partial";
}

/**
 * Inserta texto en la posición `at`, desplazando lo que venga detrás.
 *
 * Un rango que contiene la posición **por dentro** crece: escribir en mitad de
 * una palabra en negrita produce texto en negrita. En las fronteras no se
 * extiende, ni por delante ni por detrás, así que el texto que entra pegado a
 * un tramo con estilo entra limpio. Esta es la política de este sprint; el
 * caso real de escribir con el teclado ni siquiera pasa por aquí, porque al
 * teclear se lee el DOM en vez de mutar el modelo.
 *
 * @param {Model} model
 * @param {number} at
 * @param {string} text
 * @returns {Model}
 */
export function insertText(model, at, text) {
  if (text === "") return normalize(model);

  const position = clamp(at, 0, model.text.length);
  const length = text.length;

  const ranges = model.ranges.map((range) => ({
    style: range.style,
    start: range.start >= position ? range.start + length : range.start,
    end: range.end > position ? range.end + length : range.end,
  }));

  return normalize({
    text: model.text.slice(0, position) + text + model.text.slice(position),
    ranges,
  });
}

/**
 * Borra el tramo `[from, to)` del texto y recorta los rangos que lo cruzan.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @returns {Model}
 */
export function deleteRange(model, from, to) {
  const [start, end] = order(from, to);
  if (start === end) return normalize(model);

  const removed = end - start;
  const shift = (position) => {
    if (position <= start) return position;
    if (position >= end) return position - removed;
    return start; // Caía dentro de lo borrado: colapsa a la costura.
  };

  return normalize({
    text: model.text.slice(0, start) + model.text.slice(end),
    ranges: model.ranges.map((range) => ({
      style: range.style,
      start: shift(range.start),
      end: shift(range.end),
    })),
  });
}

/**
 * Quita **todos** los estilos del tramo. El texto no se toca: "limpiar
 * formato" devuelve exactamente las mismas letras, sin estilo.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @returns {Model}
 */
export function clearStyles(model, from, to) {
  const [start, end] = order(from, to);
  if (start === end) return normalize(model);

  const ranges = [];
  for (const range of model.ranges) {
    ranges.push(...subtract(range, start, end));
  }

  return normalize({ text: model.text, ranges });
}

/**
 * El texto sin estilo. Es un acceso trivial —el modelo ya guarda el texto
 * plano— y esa es justamente la ventaja de ADR-003: "copiar como texto plano"
 * y "limpiar formato" no tienen que deshacer nada, porque el original nunca se
 * destruyó.
 *
 * @param {Model} model
 * @returns {string}
 */
export function getPlainText(model) {
  return model.text;
}

/**
 * Los estilos que cubren por completo el tramo `[from, to)`, en el orden de
 * `STYLES`. Con la selección colapsada, los del carácter de la izquierda.
 *
 * @param {Model} model
 * @param {number} from
 * @param {number} to
 * @returns {Style[]}
 */
export function stylesAt(model, from, to) {
  return STYLES.filter((style) => hasStyle(model, from, to, style) === "all");
}

// ── Auxiliares ─────────────────────────────────────────────────────────────

/**
 * Normaliza un par de offsets: los ordena y los recorta a lo razonable. La
 * selección del DOM llega al revés en cuanto el usuario arrastra hacia atrás,
 * así que todas las operaciones empiezan por aquí en vez de confiar en quien
 * llama.
 *
 * @param {number} from
 * @param {number} to
 * @returns {[number, number]}
 */
function order(from, to) {
  const a = Math.max(0, Number.isFinite(from) ? from : 0);
  const b = Math.max(0, Number.isFinite(to) ? to : 0);
  return a <= b ? [a, b] : [b, a];
}

function clamp(value, min, max) {
  const number = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(number, max));
}

/**
 * Resta el tramo `[from, to)` a un rango. Devuelve cero, uno o dos trozos: dos
 * cuando el tramo cae justo en el centro del rango.
 *
 * @param {Range} range
 * @param {number} from
 * @param {number} to
 * @returns {Range[]}
 */
function subtract(range, from, to) {
  if (to <= range.start || from >= range.end) return [range];

  const pieces = [];
  if (range.start < from) {
    pieces.push({ start: range.start, end: from, style: range.style });
  }
  if (to < range.end) {
    pieces.push({ start: to, end: range.end, style: range.style });
  }
  return pieces;
}
