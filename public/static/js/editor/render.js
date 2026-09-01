/**
 * PintaPost — del modelo al HTML del editor (S04, B-07).
 *
 * Una sola función pura, `render(model)`, que devuelve la cadena de HTML que
 * se pinta dentro del `contenteditable`. No toca el DOM: quien la llama decide
 * qué hacer con la cadena, y es el único sitio del proyecto donde se construye
 * marcado a mano.
 *
 * ── El algoritmo: fronteras, no rangos ─────────────────────────────────────
 *
 * El modelo guarda un rango por estilo (ver `model.js`), así que dos estilos
 * pueden solaparse parcialmente y el HTML no admite etiquetas cruzadas: no
 * existe `<strong>uno <em>dos</strong> tres</em>`.
 *
 * La salida se construye recorriendo las **fronteras** de todos los rangos —el
 * `start` y el `end` de cada uno, más el principio y el final del texto— y
 * partiendo el texto por ellas. Entre dos fronteras consecutivas el conjunto de
 * estilos activos no cambia, por definición, así que cada trozo se emite con
 * sus etiquetas anidadas y bien cerradas.
 *
 * Con negrita en 0–10 y cursiva en 5–15 las fronteras son 0, 5, 10, 15:
 *
 *   0–5    <strong>…</strong>
 *   5–10   <strong><em>…</em></strong>
 *   10–15  <em>…</em>
 *
 * El anidamiento siempre sigue el orden de `STYLES`, de fuera hacia dentro. No
 * cambia lo que se ve, pero hace la salida determinista: dos modelos iguales
 * producen cadenas idénticas, y los tests pueden compararlas literalmente.
 *
 * ── Etiquetas semánticas ───────────────────────────────────────────────────
 *
 * `<strong>`, `<em>`, `<u>` y `<s>` en vez de `<span class="…">`. Un lector de
 * pantalla anuncia el énfasis, el texto se puede copiar a cualquier otro editor
 * conservando el formato, y `selection.js` las reconoce al leer el DOM de
 * vuelta. Media accesibilidad resuelta sin escribir CSS.
 *
 * ── Los saltos de línea van literales ──────────────────────────────────────
 *
 * `\n` se emite tal cual, sin `<br>`. El contenedor tiene `white-space:
 * pre-wrap`, así que se ven igual, y el texto del DOM coincide exactamente con
 * `model.text`: `selection.js` puede traducir offsets sumando longitudes de
 * nodos de texto, sin descontar etiquetas que ocupan cero caracteres.
 *
 * ── La única excepción: el `<br>` de relleno final ─────────────────────────
 *
 * Un texto que termina en `\n` es el único caso en que el salto literal no
 * basta. El navegador no dibuja la línea vacía que queda al final de un
 * bloque, así que el usuario pulsa Enter y no ve pasar el cursor a la línea
 * siguiente: está ahí, pero no hay dónde pintarlo. La solución de siempre es
 * cerrar con un `<br>` que solo existe para dar altura a esa línea.
 *
 * No desequilibra la lectura de vuelta. `selection.js` ya distingue el `<br>`
 * de relleno —el que no tiene nada detrás dentro de su bloque— del que
 * representa un salto real, precisamente porque los navegadores insertan el
 * suyo con ese mismo criterio. `readModelFromDom(render(m))` sigue siendo `m`.
 */

"use strict";

import { STYLES } from "./model.js";

/**
 * La etiqueta de cada estilo. El orden de anidamiento lo da `STYLES`, no este
 * objeto.
 */
const TAGS = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strikethrough: "s",
};

/**
 * Modelo → HTML.
 *
 * @param {import("./model.js").Model} model
 * @returns {string}
 */
export function render(model) {
  const text = model.text ?? "";
  if (text === "") return "";

  const ranges = (model.ranges ?? []).filter((range) => range.start < range.end);
  let html = "";

  for (const { start, end } of segments(text.length, ranges)) {
    const active = STYLES.filter((style) =>
      ranges.some(
        (range) =>
          range.style === style && range.start <= start && range.end >= end,
      ),
    );

    const open = active.map((style) => `<${TAGS[style]}>`).join("");
    const close = active
      .map((style) => `</${TAGS[style]}>`)
      .reverse()
      .join("");

    html += open + escapeHtml(text.slice(start, end)) + close;
  }

  // Ver la cabecera: sin este relleno, la línea vacía que deja un Enter final
  // no tiene altura y el cursor no puede colocarse en ella.
  return text.endsWith("\n") ? `${html}<br>` : html;
}

/**
 * Parte `[0, length)` por las fronteras de los rangos. Devuelve tramos
 * contiguos, sin huecos y sin solapes, cada uno con un conjunto de estilos
 * constante.
 *
 * @param {number} length
 * @param {import("./model.js").Range[]} ranges
 * @returns {{ start: number, end: number }[]}
 */
function segments(length, ranges) {
  const boundaries = new Set([0, length]);
  for (const range of ranges) {
    if (range.start > 0 && range.start < length) boundaries.add(range.start);
    if (range.end > 0 && range.end < length) boundaries.add(range.end);
  }

  const puntos = [...boundaries].sort((a, b) => a - b);
  const tramos = [];
  for (let i = 0; i < puntos.length - 1; i += 1) {
    tramos.push({ start: puntos[i], end: puntos[i + 1] });
  }
  return tramos;
}

/**
 * Escapa lo que rompería el marcado. El texto lo escribe el usuario, así que
 * un `<script>` tecleado en el editor tiene que salir como cuatro palabras
 * visibles y no como una etiqueta.
 *
 * Bastan `&`, `<` y `>`: la cadena solo se usa como contenido de elemento,
 * nunca dentro de un atributo, así que las comillas no son peligrosas aquí. El
 * `&` va primero, o convertiría en entidades las que acaba de escribir.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
