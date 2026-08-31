/**
 * PintaPost — constantes de los bloques Unicode matemáticos (S03, ADR-004).
 *
 * Aquí no hay lógica: solo los puntos de inicio de cada bloque y las marcas
 * combinables. La transformación vive en `unicode.js`.
 *
 * ── Por qué sans-serif y no serif ──────────────────────────────────────────
 *
 * Unicode define varias familias matemáticas (serif, sans-serif, monoespaciada,
 * script, fraktur…). Usamos siempre las **sans-serif** por dos motivos:
 *
 * 1. LinkedIn renderiza su interfaz en una fuente sans. Una negrita serif se ve
 *    como un cuerpo extraño incrustado en el párrafo; la sans-serif se integra.
 *
 * 2. **Los bloques sans-serif no tienen huecos, y los serif sí.** El bloque
 *    *Mathematical Italic* serif carece de la `h` minúscula: la posición que le
 *    correspondería, `U+1D455`, está reservada porque Unicode ya había asignado
 *    ℎ (constante de Planck) en `U+210E` mucho antes. Implementar la cursiva
 *    serif con una fórmula de desplazamiento produciría ahí un carácter no
 *    asignado, y palabras tan comunes como *hola*, *hacer* o *ahora* saldrían
 *    con un hueco o una caja vacía. En los bloques sans-serif las 26 letras de
 *    cada rango están completas y consecutivas, así que la fórmula es segura
 *    sin una sola excepción.
 *
 * ── Sobre los dígitos ──────────────────────────────────────────────────────
 *
 * Solo existen dígitos en negrita (`U+1D7EC`). Unicode no define dígitos
 * itálicos en ninguna familia, ni los definirá: la cursiva de un número no es
 * una distinción semántica en notación matemática. Por eso `digits` es `null`
 * en cursiva y en negrita-cursiva, y `unicode.js` deja el dígito intacto
 * (ADR-005).
 */

"use strict";

/**
 * Anclas del alfabeto latino de entrada. La fórmula de desplazamiento es
 * `bloque + (codepoint - ancla)`, así que estas tres constantes son el origen
 * de coordenadas de todo el mapeo.
 */
export const ASCII = Object.freeze({
  UPPER_A: 0x41, // "A"
  UPPER_Z: 0x5a, // "Z"
  LOWER_A: 0x61, // "a"
  LOWER_Z: 0x7a, // "z"
  DIGIT_0: 0x30, // "0"
  DIGIT_9: 0x39, // "9"
});

/**
 * Primer codepoint de cada rango sans-serif, por estilo de bloque.
 *
 * Las claves son los tres estilos que **cambian el carácter**. El subrayado y
 * el tachado no aparecen aquí porque no son bloques: son marcas combinables que
 * se añaden encima de lo que ya haya (ver `COMBINING`).
 *
 * `digits: null` significa "este estilo no tiene dígitos en Unicode".
 */
export const BLOCKS = Object.freeze({
  /** 𝗔 𝗮 𝟬 — Mathematical Sans-Serif Bold */
  bold: Object.freeze({
    upper: 0x1d5d4,
    lower: 0x1d5ee,
    digits: 0x1d7ec,
  }),

  /** 𝘈 𝘢 — Mathematical Sans-Serif Italic */
  italic: Object.freeze({
    upper: 0x1d608,
    lower: 0x1d622,
    digits: null,
  }),

  /** 𝘼 𝙖 — Mathematical Sans-Serif Bold Italic */
  boldItalic: Object.freeze({
    upper: 0x1d63c,
    lower: 0x1d656,
    digits: null,
  }),
});

/**
 * Marcas diacríticas combinables que aportan estilo.
 *
 * A diferencia de los bloques, estas no sustituyen el carácter: se escriben
 * **detrás** de él y el motor de texto las dibuja encima o a través. Por eso se
 * acumulan sobre cualquier letra, sobre los dígitos y sobre los caracteres que
 * no tienen mapeo matemático, y por eso el subrayado y el tachado funcionan
 * donde la negrita no llega.
 *
 * Se aplican por **grafema**, no por codepoint: en `a + U+0301` la marca de
 * estilo va al final del grupo, nunca entre la letra y su tilde.
 */
export const COMBINING = Object.freeze({
  /** U+0332 COMBINING LOW LINE — subrayado */
  UNDERLINE: "\u0332",
  /** U+0336 COMBINING LONG STROKE OVERLAY — tachado */
  STRIKETHROUGH: "\u0336",
});

/**
 * Longitud de cada rango alfabético y numérico. Se usa para acotar la fórmula
 * y para que los tests puedan recorrer un bloque entero sin números mágicos.
 */
export const RANGE_LENGTH = Object.freeze({
  LETTERS: 26,
  DIGITS: 10,
});
