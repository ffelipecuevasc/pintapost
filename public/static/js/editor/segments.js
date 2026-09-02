/**
 * PintaPost — la segmentación compartida (S05, tarea 1).
 *
 * Una sola función pura, `segments(length, ranges, protectedRanges)`, que parte
 * `[0, length)` por las fronteras de todos los rangos y devuelve tramos
 * contiguos, sin huecos y sin solapes, cada uno con un conjunto de estilos
 * constante y una marca de si está protegido.
 *
 * ── Por qué vive aquí y no dentro de `render.js` ───────────────────────────
 *
 * Nació ahí, como función privada del renderizador. El S05 la saca porque el
 * serializador necesita **exactamente** la misma partición: si `render` y
 * `serialize` calcularan los tramos por su cuenta, cualquier discrepancia entre
 * las dos implementaciones —un `<=` donde el otro pone `<`, un rango vacío que
 * uno descarta y el otro no— haría que el usuario copiara algo distinto de lo
 * que ve en pantalla, y ese es el único fallo que este producto no se puede
 * permitir. Con una sola función, la divergencia es imposible por construcción.
 *
 * ── Qué es una frontera ────────────────────────────────────────────────────
 *
 * El `start` y el `end` de cada rango de estilo, el `start` y el `end` de cada
 * tramo protegido, y los extremos del texto. Entre dos fronteras consecutivas
 * ni el conjunto de estilos activos ni la condición de protegido pueden
 * cambiar, por definición, así que cada tramo se puede tratar como una unidad.
 *
 * Con negrita en 0–10, cursiva en 5–15 y un hashtag protegido en 7–12:
 *
 *   0–5    bold
 *   5–7    bold italic
 *   7–10   bold italic  · protegido
 *   10–12  italic       · protegido
 *   12–15  italic
 *
 * Un tramo protegido no anula los estilos que lo cubren: los sigue declarando.
 * Es cada consumidor el que decide qué hacer con esa combinación —`serialize`
 * emite el texto literal y `render` lo pinta con una pista visual—, y la
 * decisión no se puede tomar aquí porque no es la misma en los dos sitios.
 *
 * ── Unidades ───────────────────────────────────────────────────────────────
 *
 * Todo en unidades UTF-16, como el resto del modelo (ADR-019).
 */

"use strict";

import { STYLES } from "./model.js";

/**
 * @typedef {{ start: number, end: number,
 *             styles: import("./model.js").Style[],
 *             protected: boolean }} Segment
 */

/**
 * Parte `[0, length)` por las fronteras de los rangos.
 *
 * @param {number} length Longitud del texto, en unidades UTF-16.
 * @param {import("./model.js").Range[]} [ranges] Rangos de estilo del modelo.
 * @param {{ start: number, end: number }[]} [protectedRanges] Tramos que no
 *   deben recibir formato: lo que devuelve `findProtected` (ADR-013).
 * @returns {Segment[]} Tramos en orden, o `[]` si el texto está vacío. Los
 *   `styles` vienen en el orden de `STYLES`, que es estable a propósito: hace
 *   la salida determinista y comparable literalmente en los tests.
 */
export function segments(length, ranges = [], protectedRanges = []) {
  if (!Number.isFinite(length) || length <= 0) return [];

  // Los rangos vacíos no aportan ninguna frontera nueva y sí ensuciarían la
  // comprobación de cobertura de abajo, donde `start <= x && end >= x` es cierto
  // de forma degenerada para un rango de longitud cero.
  const styled = (ranges ?? []).filter((range) => range.start < range.end);
  const guarded = (protectedRanges ?? []).filter(
    (range) => range.start < range.end,
  );

  const boundaries = new Set([0, length]);
  for (const range of [...styled, ...guarded]) {
    if (range.start > 0 && range.start < length) boundaries.add(range.start);
    if (range.end > 0 && range.end < length) boundaries.add(range.end);
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];

    result.push({
      start,
      end,
      // Un estilo cubre el tramo o no lo cubre: no hay término medio, porque el
      // tramo se cortó justo en sus fronteras.
      styles: STYLES.filter((style) =>
        styled.some(
          (range) =>
            range.style === style && range.start <= start && range.end >= end,
        ),
      ),
      protected: guarded.some(
        (range) => range.start <= start && range.end >= end,
      ),
    });
  }

  return result;
}
