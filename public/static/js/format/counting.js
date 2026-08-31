/**
 * PintaPost — medición de longitudes (S03, alimenta B-16 y ADR-012).
 *
 * Una sola función pura, `count(text)`, que devuelve las tres formas de medir
 * una cadena. No transforma nada: solo cuenta.
 *
 * ── Por qué hacen falta las tres ───────────────────────────────────────────
 *
 * Un texto Unicode no tiene "una" longitud. Tiene tres, y en texto latino
 * normal coinciden, así que es fácil no darse cuenta de que son distintas
 * hasta que aparece un carácter matemático. Tomando la "á" en negrita:
 *
 *   𝗮́  =  U+1D5EE (a sans-serif negrita)  +  U+0301 (acento agudo)
 *
 *   utf16       3   el par subrogado del carácter matemático cuenta 2, más 1
 *               del acento. Es lo que devuelve `text.length` en JavaScript.
 *   codepoints  2   dos caracteres Unicode reales.
 *   graphemes   1   una sola letra, que es lo que el usuario ve y lo que
 *               borra de un solo golpe de retroceso.
 *
 * El usuario cuenta grafemas: escribe una letra y espera que ocupe uno. Pero
 * si LinkedIn cuenta unidades UTF-16 —lo habitual, porque es lo que devuelve
 * `length` en JavaScript y `NSString` en iOS—, un post enteramente en negrita
 * con tildes alcanza el límite de 3.000 a menos de la mitad de su longitud
 * aparente, y el texto se trunca sin que nada explique por qué.
 *
 * De ahí el contador dual del S05 (ADR-012): mostrar a la vez la longitud del
 * texto plano y la de la cadena serializada, y avisar con el peor caso de los
 * dos. Cuál de las tres medidas usa LinkedIn está aún sin confirmar; se
 * comprueba empíricamente en la tarea 6 de este sprint (B-05).
 *
 * ── Sobre `Intl.Segmenter` ─────────────────────────────────────────────────
 *
 * Es la única forma correcta de contar grafemas: agrupa emojis compuestos por
 * ZWJ, banderas, tonos de piel y letras con sus diacríticas siguiendo la regla
 * de Unicode, que es demasiado larga para reimplementarla a mano. ADR-003 lo
 * reserva justo para aquí, sobre la cadena ya serializada, que es donde el
 * recuento tiene que ser exacto.
 *
 * Está disponible en todos los navegadores objetivo (Chrome 87+, Safari 14.1+,
 * Firefox 125+). Si no existe —Safari antiguo—, `graphemes` cae a
 * `codepoints`: es la aproximación más cercana y solo se queda corta con los
 * emojis compuestos y las letras con tilde, no con el texto corriente. Se
 * degrada, no se rompe.
 */

"use strict";

/**
 * Un único segmentador para todo el módulo: construirlo es caro y el contador
 * se llama en cada pulsación de tecla.
 *
 * `null` significa que este navegador no tiene `Intl.Segmenter`. La
 * construcción va en `try/catch` porque un motor puede exponer el constructor
 * y no aceptar la granularidad de grafema.
 */
const graphemeSegmenter = createGraphemeSegmenter();

function createGraphemeSegmenter() {
  try {
    if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
      return null;
    }
    // Sin locale: la segmentación en grafemas no depende del idioma.
    return new Intl.Segmenter(undefined, { granularity: "grapheme" });
  } catch (error) {
    return null;
  }
}

/**
 * Cuenta los grafemas de `text`, o cae a codepoints si no hay segmentador.
 *
 * `Intl.Segmenter` no expone un tamaño directo, así que hay que recorrer los
 * segmentos. Se cuentan sin materializar el array, que en un post de 3.000
 * caracteres sería basura innecesaria en cada tecleo.
 */
function countGraphemes(text, codepoints) {
  if (graphemeSegmenter === null) return codepoints;

  let total = 0;
  for (const segment of graphemeSegmenter.segment(text)) {
    void segment;
    total += 1;
  }
  return total;
}

/**
 * Mide `text` de las tres formas posibles.
 *
 * @param {string} text Texto plano o ya serializado; da igual, solo se mide.
 * @returns {{utf16: number, codepoints: number, graphemes: number}}
 *   `utf16` es lo que cuenta `String.prototype.length`; `codepoints` son
 *   caracteres Unicode reales; `graphemes` es lo que el usuario percibe como
 *   letras. Para una cadena vacía, los tres valen 0.
 */
export function count(text) {
  if (typeof text !== "string" || text === "") {
    return { utf16: 0, codepoints: 0, graphemes: 0 };
  }

  const utf16 = text.length;
  const codepoints = [...text].length;

  return {
    utf16,
    codepoints,
    graphemes: countGraphemes(text, codepoints),
  };
}
