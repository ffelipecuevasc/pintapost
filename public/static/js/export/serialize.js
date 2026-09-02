/**
 * PintaPost — del modelo a la cadena que se pega en LinkedIn (S05 tarea 3, B-13).
 *
 * Una sola función pura, `serialize(model, options)`. Es el sitio donde ADR-003
 * se cumple de verdad: el editor nunca contiene caracteres matemáticos, y la
 * conversión ocurre **solo aquí**, en el momento de copiar.
 *
 * ── El algoritmo, en tres líneas ───────────────────────────────────────────
 *
 * 1. Detectar los hashtags y las menciones sobre `model.text` (`protect.js`).
 * 2. Partir el texto en tramos con `segments`, la **misma** función que usa
 *    `render` para pintar. Ahí está la garantía de que lo que se copia es lo
 *    que se ve.
 * 3. Pasar cada tramo por `toStyled` con sus estilos, salvo los protegidos, que
 *    salen literales.
 *
 * ── Pura, y no por purismo ─────────────────────────────────────────────────
 *
 * No toca el DOM, no lee `localStorage` ni ninguna configuración global, no
 * muta el modelo. Las opciones llegan por parámetro y quien las lee es
 * `settings.js`.
 *
 * Tiene una consecuencia práctica que va más allá de poder probarla sin
 * navegador: al ser pura es **síncrona**, y de eso depende que el copiado
 * funcione en Safari de iOS. Ese navegador pierde el contexto del gesto del
 * usuario si hay un `await` antes de escribir en el portapapeles, y la
 * escritura falla en silencio (H-17). `clipboard.js` puede llamar a `serialize`
 * dentro del `click` y pasar el resultado a `writeText` sin esperar a nada,
 * porque aquí no hay nada que esperar. Si algún día esta función se volviera
 * asíncrona, habría que pasar una Promise a `ClipboardItem` en lugar de un
 * `await`, y conviene saberlo antes de intentarlo.
 *
 * ── Lo que este archivo NO hace ────────────────────────────────────────────
 *
 * No modifica `unicode.js`, cerrado desde el S03. Todo el conocimiento sobre
 * bloques Unicode, grafemas, marcas combinables y saltos de línea vive allí;
 * aquí solo se decide **qué trozo** lleva **qué estilo**.
 *
 * En particular, que un salto de línea dentro de un tramo subrayado no arrastre
 * la marca combinable al renglón siguiente ya lo resuelve `toStyled`, que trata
 * los saltos como grafemas sobre los que no se dibuja nada. Serializar no tiene
 * que cortar por los saltos ni saber que existen; el test que lo comprueba está
 * en `serialize.test.js` porque es la garantía la que importa, no dónde se
 * implemente.
 */

"use strict";

import { segments } from "../editor/segments.js";
import { toStyled } from "../format/unicode.js";
import { findProtected } from "./protect.js";

/**
 * Modelo → cadena Unicode lista para el portapapeles.
 *
 * @param {import("../editor/model.js").Model} model
 * @param {{ styleCombining?: boolean }} [options]
 *   `styleCombining` vale `true` por defecto. Con `false` —la casilla de máxima
 *   compatibilidad de ADR-018— las letras con diacrítica salen sin estilizar:
 *   evita que la tilde se descoloque en Chrome de escritorio y abarata el
 *   recuento UTF-16 con el que LinkedIn mide el límite de 3.000 (ADR-012).
 * @returns {string} Cadena nueva. El modelo no se toca.
 */
export function serialize(model, { styleCombining = true } = {}) {
  const text = model?.text ?? "";
  if (text === "") return "";

  const ranges = model?.ranges ?? [];
  const pieces = segments(text.length, ranges, findProtected(text));

  let result = "";
  for (const segment of pieces) {
    const chunk = text.slice(segment.start, segment.end);

    // ADR-013: el tramo protegido sale tal cual **aunque el modelo lo declare
    // en negrita**. Es la razón de que `segments` no anule los estilos por su
    // cuenta: la decisión es de cada consumidor, y aquí es «ignóralos».
    if (segment.protected) {
      result += chunk;
      continue;
    }

    result += toStyled(chunk, styleFor(segment.styles, styleCombining));
  }

  return result;
}

/**
 * Traduce la lista de estilos de un tramo al objeto que espera `toStyled`.
 *
 * Los nombres del modelo —`bold`, `italic`, `underline`, `strikethrough`— son
 * exactamente los de las opciones de `toStyled`, así que la traducción es
 * literal. No es casualidad ni es frágil: que los dos vocabularios coincidan es
 * lo que permite que esta función quepa en cinco líneas en lugar de ser una
 * tabla de correspondencias más que mantener.
 *
 * @param {import("../editor/model.js").Style[]} styles
 * @param {boolean} styleCombining
 * @returns {Record<string, boolean>}
 */
function styleFor(styles, styleCombining) {
  const style = { styleCombining };
  for (const name of styles) style[name] = true;
  return style;
}
