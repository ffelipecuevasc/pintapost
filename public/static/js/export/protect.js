/**
 * PintaPost — hashtags y menciones (S05 tarea 2, B-17, ADR-013).
 *
 * Una sola función pura, `findProtected(text)`, que devuelve los tramos del
 * texto que **nunca** deben recibir formato Unicode.
 *
 * ── Por qué se detecta aquí y no se guarda en el modelo ────────────────────
 *
 * Parecería más limpio marcar los hashtags al escribirlos y no dejar que
 * reciban estilo nunca. Es peor, y por un motivo concreto: ser hashtag no es
 * una propiedad del texto, es una **forma que el texto tiene ahora mismo**.
 * `#Marketing` deja de serlo en cuanto el usuario borra la almohadilla, y
 * vuelve a serlo si la reescribe.
 *
 * Guardado en el modelo sería un dato derivado tratado como fuente de verdad, y
 * habría que resincronizarlo en cada inserción, borrado, pegado y deshacer:
 * cuatro sitios donde el modelo puede acabar mintiendo sobre su propio texto,
 * con el agravante de que el error es silencioso. No se vería en el editor; se
 * vería al pegar en LinkedIn, cuando ya es tarde.
 *
 * Calculado como función pura del texto vigente no hay nada que sincronizar: la
 * respuesta se deriva siempre de `model.text`, así que por construcción no
 * puede estar desfasada.
 *
 * Encaja además con el reparto que ya gobierna el proyecto (ADR-003). El modelo
 * guarda la **intención** —«esto va en negrita»— y la presentación decide qué
 * hacer con ella. El usuario puede perfectamente poner un hashtag en negrita;
 * lo que ocurre es que `render` y `serialize` deciden no honrarlo, cada uno a su
 * manera. Y si luego borra la `#`, la negrita que ya había pedido aparece sola,
 * sin que nadie tenga que restaurarla.
 *
 * ── Por qué importa (ADR-013) ──────────────────────────────────────────────
 *
 * `#𝗠𝗮𝗿𝗸𝗲𝘁𝗶𝗻𝗴` no se convierte en enlace ni agrupa en LinkedIn, y una mención
 * estilizada deja de notificar a nadie. Poner en negrita justo la palabra clave
 * le cuesta alcance real al usuario, que es lo contrario de lo que venía a
 * buscar.
 *
 * ── La regla, y sus dos bordes ─────────────────────────────────────────────
 *
 * El símbolo va al principio del texto o precedido de un espacio en blanco, y
 * detrás lleva al menos una letra, número, guion bajo o guion.
 *
 * De ahí salen los dos casos límite que hay que acertar:
 *
 *   hola@ejemplo.com   la arroba va precedida de letra → NO es una mención
 *   # solo             no lleva nada detrás            → NO es nada
 *
 * `\p{L}` y `\p{N}` con la bandera `u` en vez de `\w`: `#Diseño` y `#Año2026`
 * son hashtags perfectamente válidos en LinkedIn, y `\w` los cortaría en la
 * primera letra acentuada dejando media etiqueta con formato y media sin él.
 */

"use strict";

/**
 * El símbolo, su contexto por la izquierda y su cuerpo.
 *
 * El contexto se captura en un grupo en lugar de usar `lookbehind`. Es
 * equivalente y funciona en Safari anterior a 16.4, que es parte del abanico de
 * navegadores objetivo; el precio es tener que sumar la longitud del grupo al
 * índice del match, que es la única línea rara de este archivo.
 *
 * Al no consumir más que un carácter de contexto, dos hashtags seguidos
 * separados por un espacio se detectan los dos: el `lastIndex` queda al final
 * del primero y el espacio que precede al segundo sigue disponible.
 */
const PROTECTED = /(^|\s)([#@][\p{L}\p{N}_-]+)/gu;

/**
 * Los tramos de `text` que no deben recibir formato.
 *
 * @param {string} text Texto plano del modelo.
 * @returns {{ start: number, end: number }[]} Tramos en unidades UTF-16
 *   (ADR-019), ordenados y sin solapes. Lista vacía si no hay ninguno.
 */
export function findProtected(text) {
  if (typeof text !== "string" || text === "") return [];

  const found = [];
  // `lastIndex` es estado mutable de la expresión regular. Se reinicia a mano
  // porque la constante es de módulo y la comparte todo el que llame: sin esto,
  // la segunda llamada empezaría a buscar donde acabó la primera.
  PROTECTED.lastIndex = 0;

  let match = PROTECTED.exec(text);
  while (match !== null) {
    const start = match.index + match[1].length;
    found.push({ start, end: start + match[2].length });
    match = PROTECTED.exec(text);
  }

  return found;
}
