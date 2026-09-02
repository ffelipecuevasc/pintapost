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
 * La salida se construye recorriendo las **fronteras** de todos los rangos y
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
 * Ese reparto **ya no se calcula aquí**: vive en `segments.js` desde el S05,
 * porque el serializador necesita exactamente el mismo. Dos implementaciones
 * separadas acabarían divergiendo, y el día que lo hicieran el usuario copiaría
 * algo distinto de lo que ve en pantalla.
 *
 * ── Hashtags y menciones: se ven, pero no se van a formatear ───────────────
 *
 * `#etiqueta` y `@mención` no reciben formato Unicode al copiar (ADR-013), así
 * que el editor tiene que **avisarlo antes**: si se pintaran en negrita y luego
 * salieran en redonda, el usuario descubriría la diferencia al pegar en
 * LinkedIn y pensaría que el producto falla.
 *
 * Cada tramo protegido se envuelve en un `<span class="protected">` con su
 * `title`, y `styles.css` neutraliza ahí la negrita y la cursiva heredadas. La
 * pista es discreta a propósito: un color y un tooltip, ni iconos ni avisos que
 * interrumpan la escritura.
 *
 * El span va **por dentro** de las etiquetas de estilo, no en su lugar, y eso
 * es deliberado. El modelo guarda la intención del usuario aunque el motor
 * decida no honrarla, así que `<strong>` tiene que seguir estando en el DOM
 * para que `readModelFromDom` recupere el rango: el invariante
 * `readModelFromDom(render(m)) === m` es lo que sostiene las dos direcciones
 * del flujo del editor, y no se rompe por una pista visual. Si el usuario borra
 * la almohadilla, la negrita que ya había pedido aparece sola.
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

import { segments } from "./segments.js";
import { findProtected } from "../export/protect.js";

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
 * El tooltip del tramo protegido. Explica la causa en una frase, que es lo que
 * el usuario necesita para no pensar que el editor se equivocó.
 *
 * Sin comillas ni signos de mayor o menor: va dentro de un atributo, y lo único
 * que escapa `escapeHtml` es el contenido de elemento.
 */
const PROTECTED_TITLE =
  "Los hashtags y las menciones no reciben formato: LinkedIn dejaría de " +
  "reconocerlos como enlace.";

/**
 * Modelo → HTML.
 *
 * @param {import("./model.js").Model} model
 * @returns {string}
 */
export function render(model) {
  const text = model.text ?? "";
  if (text === "") return "";

  const ranges = model.ranges ?? [];
  let html = "";

  for (const segment of segments(text.length, ranges, findProtected(text))) {
    const open = segment.styles.map((style) => `<${TAGS[style]}>`).join("");
    const close = segment.styles
      .map((style) => `</${TAGS[style]}>`)
      .reverse()
      .join("");

    const chunk = escapeHtml(text.slice(segment.start, segment.end));
    const body = segment.protected
      ? `<span class="protected" title="${PROTECTED_TITLE}">${chunk}</span>`
      : chunk;

    html += open + body + close;
  }

  // Ver la cabecera: sin este relleno, la línea vacía que deja un Enter final
  // no tiene altura y el cursor no puede colocarse en ella.
  return text.endsWith("\n") ? `${html}<br>` : html;
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
