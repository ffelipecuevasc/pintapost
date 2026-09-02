/**
 * PintaPost — el separador de miles del contador (S05).
 *
 * _Archivo añadido sobre la marcha: no estaba en la estructura del sprint._
 *
 * ── Por qué no `toLocaleString("es-ES")` ───────────────────────────────────
 *
 * Porque en el rango de números que maneja este contador no hace nada.
 *
 * El español de España omite el separador de miles en los números de **cuatro
 * cifras**: CLDR le asigna `minimumGroupingDigits: 2`, así que `(2800)
 * .toLocaleString("es-ES")` devuelve `2800` y no `2.800`. Es correcto según la
 * norma, y es exactamente el caso de este contador, cuyo techo son los 3.000
 * caracteres de LinkedIn: todas las cifras interesantes tienen cuatro dígitos,
 * y el separador no aparecería nunca.
 *
 * La alternativa era pasar `{ minimumGroupingDigits: 1 }`, que funciona pero
 * ata la presentación a que el navegador traiga los datos de ICU del español.
 * Un `1.890` con un punto en medio es una regla de tres líneas; hacerla
 * nosotros la vuelve idéntica en todos los navegadores y en los tests, y no
 * depende de qué locales tenga compilado el motor.
 */

"use strict";

/**
 * Agrupa de tres en tres con punto, a la española. `1890` → `1.890`.
 *
 * @param {number} value Un entero no negativo.
 * @returns {string}
 */
export function groupThousands(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Un número de caracteres con su sustantivo concordado.
 *
 * El singular importa más de lo que parece: «1 caracteres» en la esquina de la
 * pantalla es justo el detalle que hace dudar de si el resto de las cifras
 * están bien.
 *
 * @param {number} value
 * @returns {string}
 */
export function characters(value) {
  return `${groupThousands(value)} ${value === 1 ? "carácter" : "caracteres"}`;
}
