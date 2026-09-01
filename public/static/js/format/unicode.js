/**
 * PintaPost — transformación a Unicode matemático y su reversa (S03, B-01/B-04).
 *
 * API pública del motor de formato:
 *
 *   toStyled(text, style)   texto normal     → texto estilizado para LinkedIn
 *   stripStyling(text)      texto estilizado → texto normal
 *   isStyleable(char)       ¿este carácter tiene equivalente en algún bloque?
 *
 * Son funciones **puras**: no tocan el DOM, no leen `window` ni `localStorage`,
 * no mutan sus argumentos y devuelven cadenas nuevas. La conversión ocurre solo
 * al copiar; el editor nunca contiene estos caracteres (ADR-003).
 *
 * ── El algoritmo, en orden ─────────────────────────────────────────────────
 *
 * 1. Agrupar el texto en **grafemas** (una letra con todo lo que se dibuja
 *    encima o pegado a ella), nunca en unidades UTF-16.
 * 2. Descomponer cada grafema con `normalize("NFD")`, que separa la letra base
 *    de sus marcas diacríticas: "á" → "a" + U+0301.
 * 3. Transformar **solo la letra base** con la fórmula de desplazamiento.
 * 4. Volver a escribir detrás las marcas diacríticas, intactas.
 * 5. Si el estilo lleva subrayado o tachado, añadir su marca combinable al
 *    final del grafema completo.
 *
 * ── Estricto al escribir, tolerante al leer ────────────────────────────────
 *
 * `toStyled` y `stripStyling` no son simétricas, y es deliberado.
 *
 * `toStyled` es **estricta**: produce sans-serif y nada más (ADR-004), en las
 * combinaciones que ofrece la interfaz. Es la única salida del motor y define
 * lo que este producto pone en el portapapeles.
 *
 * `stripStyling` es **tolerante**: reconoce las catorce familias del bloque
 * matemático —serif, script, fraktur, doble raya, monoespaciada— y los
 * sustitutos de Letterlike Symbols, aunque el motor no genere ninguna de ellas.
 *
 * No es generosidad. Casi todos los formateadores de LinkedIn usan el bloque
 * serif, así que el texto que el usuario pega viene de ahí. En el S04
 * `stripStyling` será lo que normalice ese pegado antes de que entre al modelo;
 * si solo reconociera lo que produce `toStyled`, los caracteres matemáticos
 * ajenos entrarían intactos en `{ text, ranges }`, que es exactamente lo que
 * ADR-003 prohíbe. Una función que solo sabe deshacer lo que ella misma hizo no
 * sirve para limpiar lo que llega de fuera.
 *
 * ── La opción de máxima compatibilidad ─────────────────────────────────────
 *
 * `toStyled` acepta `styleCombining` en el objeto de estilo. Vale `true` por
 * defecto: todo se estiliza, incluidas las letras acentuadas, que es el
 * comportamiento que este archivo describe en el algoritmo de arriba.
 *
 * Con `styleCombining: false`, cualquier grafema que tras NFD necesite marcas
 * combinables se emite sin transformar, y el resto del texto sí se estiliza.
 * Resuelve dos problemas de un tiro (ADR-018): la tilde sobre una base
 * matemática se descoloca en Chrome de escritorio —el riesgo que ADR-005 dejó
 * aceptado, materializado en uno de los cinco entornos—, y una vocal acentuada
 * en negrita cuesta 3 unidades UTF-16 frente a 1 en plano, que es la moneda con
 * la que LinkedIn mide el límite de 3.000 (ADR-012).
 *
 * ── Por qué NFD y no una tabla de letras base ──────────────────────────────
 *
 * El bloque matemático no define ninguna letra acentuada y nunca lo hará, así
 * que la única salida es estilizar la base y devolverle el acento encima. NFD
 * es exactamente esa operación, y la resuelve con la tabla de descomposición
 * canónica que ya trae el propio motor de JavaScript.
 *
 * Escribir a mano una tabla { "á": "a", "é": "e", … } sería reimplementar peor
 * un fragmento de esa tabla: cubriría las siete letras del español que uno
 * recuerde y fallaría en silencio con la primera "à" francesa, "ç" catalana o
 * "õ" portuguesa, que saldrían en redonda en mitad de una frase en negrita.
 * Con NFD funcionan todas las latinas acentuadas sin escribir una sola entrada,
 * y además da igual que el texto llegue precompuesto (U+00E1) o ya descompuesto
 * ("a" + U+0301): las dos formas acaban en el mismo sitio.
 *
 * La salida de `toStyled` **no** se recompone con NFC. U+1D5EE + U+0301 no
 * tiene forma precompuesta —Unicode no va a asignar un codepoint a "a
 * sans-serif matemática con tilde"— así que NFC devolvería la cadena idéntica.
 * Llamarlo no rompería nada, pero sugeriría al que lea el código un cierre
 * simétrico que no existe. `stripStyling` sí lo hace, y por un motivo
 * distinto: ver su comentario.
 */

"use strict";

import { ASCII, BLOCKS, COMBINING } from "./blocks.js";

/** U+200D ZERO WIDTH JOINER: el pegamento de los emojis compuestos. */
const ZWJ = 0x200d;

/** Rango de los indicadores regionales, que van de dos en dos (banderas). */
const REGIONAL_FIRST = 0x1f1e6;
const REGIONAL_LAST = 0x1f1ff;

/**
 * Saltos de línea: LF, CR, y los separadores de línea y de párrafo de Unicode.
 *
 * No reciben marca de subrayado ni de tachado: una marca combinable después de
 * un salto no tiene sobre qué dibujarse y aparece como un resto flotante al
 * principio de la línea siguiente.
 *
 * Se escriben como codepoints numéricos porque U+2028 y U+2029 son invisibles
 * en el código fuente y nadie sabría qué está leyendo.
 */
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCodePoint(0x2029);
const LINE_BREAKS = new Set(["\n", "\r", LINE_SEPARATOR, PARAGRAPH_SEPARATOR]);

/**
 * Codepoints que solo aparecen dentro de secuencias de emoji: el ZWJ, el
 * selector de variación emoji (U+FE0F), el marco de tecla (U+20E3) y los
 * modificadores de tono de piel.
 *
 * Si un grafema contiene alguno, no se le aplica la fórmula aunque su base sea
 * una letra o un dígito. El emoji de tecla "1️⃣" es 1 + U+FE0F + U+20E3: su
 * base es un dígito, pero convertirla en un dígito matemático deja el marco
 * huérfano y rompe el emoji.
 */
const VARIATION_SELECTOR_16 = 0xfe0f;
const COMBINING_KEYCAP = 0x20e3;
const EMOJI_GLUE = new Set([ZWJ, VARIATION_SELECTOR_16, COMBINING_KEYCAP]);

/** Modificadores de tono de piel (U+1F3FB–U+1F3FF). */
const EMOJI_MODIFIER = /\p{Emoji_Modifier}/u;

/** Marcas combinables (tildes, virgulillas…) y modificadores de tono de piel. */
const GRAPHEME_TRAILER = /\p{M}|\p{Emoji_Modifier}/u;

/**
 * Marcas combinables a secas, sin los modificadores de emoji.
 *
 * Es lo que distingue una letra acentuada de una letra pelada después de NFD,
 * y por tanto lo que decide qué grafemas quedan fuera de la transformación
 * cuando `styleCombining` es `false` (ADR-018).
 */
const COMBINING_MARK = /\p{M}/u;

function isRegionalIndicator(codepoint) {
  return codepoint >= REGIONAL_FIRST && codepoint <= REGIONAL_LAST;
}

/**
 * Recorre el texto agrupándolo en grafemas.
 *
 * No usa `Intl.Segmenter` a propósito: ADR-003 lo reserva para el contador de
 * caracteres, que es donde el recuento tiene que ser exacto. Aquí basta con
 * una aproximación —base más sus marcas, secuencias unidas por ZWJ y pares de
 * banderas— porque su único cometido es decidir **dónde** cae la marca de
 * subrayado o de tachado. Un grafema mal agrupado desplaza una rayita; no
 * corrompe el texto, que se reconstruye por concatenación.
 *
 * Itera sobre `[...text]`, que es un array de codepoints. Indexar ese array no
 * es indexar la cadena: nunca se parte un par subrogado.
 */
function* graphemes(text) {
  const points = [...text];
  let index = 0;

  while (index < points.length) {
    let cluster = points[index];
    index += 1;

    // Banderas: dos indicadores regionales seguidos son un solo grafema.
    if (
      isRegionalIndicator(cluster.codePointAt(0)) &&
      index < points.length &&
      isRegionalIndicator(points[index].codePointAt(0))
    ) {
      cluster += points[index];
      index += 1;
    }

    while (index < points.length) {
      const next = points[index];

      if (GRAPHEME_TRAILER.test(next)) {
        cluster += next;
        index += 1;
        continue;
      }

      // Tras un ZWJ viene siempre otra pieza del mismo emoji (familias, etc.).
      if (next.codePointAt(0) === ZWJ && index + 1 < points.length) {
        cluster += next + points[index + 1];
        index += 2;
        continue;
      }

      break;
    }

    yield cluster;
  }
}

/**
 * Traduce el estilo pedido al bloque Unicode que le corresponde.
 *
 * Devuelve `null` si el estilo no cambia el carácter (solo subrayado, solo
 * tachado, o ninguno): entonces las letras pasan tal cual y entran únicamente
 * las marcas combinables.
 */
function resolveBlock(style) {
  if (style.bold && style.italic) return BLOCKS.boldItalic;
  if (style.bold) return BLOCKS.bold;
  if (style.italic) return BLOCKS.italic;
  return null;
}

/**
 * La fórmula de desplazamiento: bloque + (codepoint − ancla).
 *
 * Devuelve `null` cuando el carácter no tiene equivalente, y entonces quien
 * llama lo deja intacto.
 */
function shiftToBlock(codepoint, block, wantsBold) {
  if (block === null) return null;

  if (codepoint >= ASCII.UPPER_A && codepoint <= ASCII.UPPER_Z) {
    return String.fromCodePoint(block.upper + codepoint - ASCII.UPPER_A);
  }

  if (codepoint >= ASCII.LOWER_A && codepoint <= ASCII.LOWER_Z) {
    return String.fromCodePoint(block.lower + codepoint - ASCII.LOWER_A);
  }

  if (codepoint >= ASCII.DIGIT_0 && codepoint <= ASCII.DIGIT_9) {
    // Unicode no tiene dígitos itálicos (ADR-005). En negrita-cursiva el dígito
    // se queda con la negrita, que es lo más parecido que existe; en cursiva
    // pura no hay nada que aplicar y sale intacto.
    const digits = block.digits ?? (wantsBold ? BLOCKS.bold.digits : null);
    if (digits === null) return null;
    return String.fromCodePoint(digits + codepoint - ASCII.DIGIT_0);
  }

  return null;
}

/** ¿Este grafema es una secuencia de emoji que no se debe tocar? */
function isEmojiSequence(cluster) {
  if (EMOJI_MODIFIER.test(cluster)) return true;

  for (const point of cluster) {
    if (EMOJI_GLUE.has(point.codePointAt(0))) return true;
  }
  return false;
}

/**
 * Añade las marcas de subrayado y tachado al final del grafema ya transformado.
 *
 * Comprueba antes que no estén puestas: así aplicar subrayado dos veces da el
 * mismo resultado que aplicarlo una, igual que ocurre de forma natural con la
 * negrita (una letra ya transformada deja de estar en el rango A–Z y la
 * fórmula no vuelve a alcanzarla).
 */
function addCombiningMarks(styled, cluster, style) {
  if (LINE_BREAKS.has(cluster)) return styled;

  let out = styled;
  if (style.underline && !out.includes(COMBINING.UNDERLINE)) {
    out += COMBINING.UNDERLINE;
  }
  if (style.strikethrough && !out.includes(COMBINING.STRIKETHROUGH)) {
    out += COMBINING.STRIKETHROUGH;
  }
  return out;
}

/**
 * ¿Este grafema queda fuera de la transformación por la opción de máxima
 * compatibilidad? (ADR-018)
 *
 * Con `styleCombining: false`, cualquier grafema que tras NFD necesite una o
 * más marcas combinables se queda sin estilizar. La regla es deliberadamente
 * amplia: alcanza a ñ y ü, que se renderizan bien en los cinco entornos, y no
 * solo a las vocales con acento agudo, que son las que se descolocan en Chrome
 * de escritorio. Una regla que cabe en una frase —"si lleva algo encima, no se
 * toca"— se recuerda; una lista de excepciones por diacrítica, no.
 */
function keepsBaseIntact(cluster, style) {
  return (
    style.styleCombining === false &&
    COMBINING_MARK.test(cluster.normalize("NFD"))
  );
}

/** Aplica el estilo a un grafema completo. Pasos 2 a 5 del algoritmo. */
function styleGrapheme(cluster, block, style) {
  // Modo de máxima compatibilidad: el grafema sale **tal y como llegó**, sin
  // descomponer. Devolverlo en NFD costaría una unidad UTF-16 de más por cada
  // letra acentuada ("ó" precompuesta ocupa 1; "o" + U+0301, 2), que es justo
  // la mitad del ahorro que esta opción viene a conseguir (ADR-018, motivo b).
  // El subrayado y el tachado sí se añaden: son marcas de estilo, no
  // diacríticas del idioma, y su sitio no depende del bloque de la base.
  if (!isEmojiSequence(cluster) && keepsBaseIntact(cluster, style)) {
    const marked = addCombiningMarks(cluster, cluster, style);
    // Sin marcas añadidas no hay nada que reordenar y se conserva la forma
    // original; con ellas sí, por el mismo motivo de orden canónico de abajo.
    return marked === cluster ? cluster : marked.normalize("NFD");
  }

  let out = "";

  if (isEmojiSequence(cluster)) {
    out = cluster;
  } else {
    // NFD separa la base de sus diacríticas. Las marcas nunca son letras ni
    // dígitos, así que la fórmula solo puede alcanzar a la base.
    for (const point of cluster.normalize("NFD")) {
      const shifted = shiftToBlock(point.codePointAt(0), block, style.bold);
      out += shifted ?? point;
    }
  }

  // Un último NFD deja las marcas en orden canónico. No es cosmética: el
  // subrayado (clase combinante 220) va antes que la tilde (230), y si la
  // salida no quedara ordenada, aplicar el mismo estilo por segunda vez
  // devolvería las mismas marcas en otro orden —cadenas equivalentes para
  // Unicode, distintas para `===`— y el formato dejaría de ser idempotente.
  // Sigue sin recomponerse con NFC: ver la cabecera del archivo.
  return addCombiningMarks(out, cluster, style).normalize("NFD");
}

/**
 * Convierte `text` al estilo pedido.
 *
 * @param {string} text Texto latino normal.
 * @param {{bold?: boolean, italic?: boolean, underline?: boolean,
 *          strikethrough?: boolean, styleCombining?: boolean}} style
 *   `styleCombining` vale `true` por defecto y es la opción de máxima
 *   compatibilidad de ADR-018: con `false`, las letras que llevan diacrítica
 *   (á é í ó ú ñ ü y cualquier otra latina acentuada) salen sin estilizar y el
 *   resto del texto sí recibe el estilo. Evita que la tilde se descoloque en
 *   Chrome de escritorio y abarata el recuento UTF-16 que mide LinkedIn
 *   (ADR-012). El subrayado y el tachado se aplican en los dos modos.
 * @returns {string} Cadena nueva. Cualquier carácter sin mapeo pasa intacto:
 *   ¿ ¡ º ª « » €, guiones largos, comillas tipográficas, espacios, saltos de
 *   línea y emojis.
 */
export function toStyled(text, style = {}) {
  if (typeof text !== "string" || text === "") return "";

  const block = resolveBlock(style);
  const hasMarks = Boolean(style.underline || style.strikethrough);

  // Sin bloque y sin marcas no hay nada que hacer; devolver el original evita
  // recorrerlo entero para reconstruirlo idéntico.
  if (block === null && !hasMarks) return text;

  let result = "";
  for (const cluster of graphemes(text)) {
    result += styleGrapheme(cluster, block, style);
  }
  return result;
}

/**
 * Rango completo del bloque *Mathematical Alphanumeric Symbols*.
 *
 * Cubre las catorce familias que Unicode define ahí —serif, sans-serif,
 * script, fraktur, doble raya, monoespaciada y sus variantes en negrita y
 * cursiva—, no solo las tres que produce `toStyled`. Los tres bloques del
 * proyecto (ADR-004) viven dentro de este rango, así que no hace falta un
 * inverso propio para ellos.
 */
const MATH_FIRST = 0x1d400;
const MATH_LAST = 0x1d7ff;

/**
 * Los 24 caracteres de *Letterlike Symbols* que rellenan los huecos reservados
 * del bloque matemático.
 *
 * Unicode dejó 28 posiciones sin asignar dentro de U+1D400–U+1D7FF porque esas
 * letras ya existían desde antes en otro sitio: la ℎ de la constante de Planck
 * (U+210E), la ℬ del script, la ℭ del fraktur, la ℝ de los números reales…
 * Cualquier herramienta que genere script o fraktur por fórmula tiene que
 * sustituirlas por estas, así que el texto pegado desde fuera las traerá
 * mezcladas con el bloque matemático y hay que limpiarlas igual.
 *
 * Van comentadas con su equivalente ASCII y su familia: los glifos son casi
 * imposibles de distinguir de una letra normal en un editor de código.
 */
const LETTERLIKE_SUBSTITUTES = new Set([
  0x2102, // ℂ → C   doble raya
  0x210a, // ℊ → g   script
  0x210b, // ℋ → H   script
  0x210c, // ℌ → H   fraktur
  0x210d, // ℍ → H   doble raya
  0x210e, // ℎ → h   cursiva (constante de Planck)
  0x2110, // ℐ → I   script
  0x2111, // ℑ → I   fraktur
  0x2112, // ℒ → L   script
  0x2115, // ℕ → N   doble raya
  0x2119, // ℙ → P   doble raya
  0x211a, // ℚ → Q   doble raya
  0x211b, // ℛ → R   script
  0x211c, // ℜ → R   fraktur
  0x211d, // ℝ → R   doble raya
  0x2124, // ℤ → Z   doble raya
  0x2128, // ℨ → Z   fraktur
  0x212c, // ℬ → B   script
  0x212d, // ℭ → C   fraktur
  0x212f, // ℯ → e   script
  0x2130, // ℰ → E   script
  0x2131, // ℱ → F   script
  0x2133, // ℳ → M   script
  0x2134, // ℴ → o   script
]);

/** ¿Este codepoint es una letra matemática, de la familia que sea? */
function isMathAlphanumeric(codepoint) {
  return (
    (codepoint >= MATH_FIRST && codepoint <= MATH_LAST) ||
    LETTERLIKE_SUBSTITUTES.has(codepoint)
  );
}

/**
 * Devuelve `text` sin nada de formato: las letras matemáticas de cualquier
 * familia vuelven a su equivalente normal y desaparecen las marcas de
 * subrayado y de tachado.
 *
 * Acepta mucho más de lo que `toStyled` produce; el porqué está en el apartado
 * "estricto al escribir, tolerante al leer" de la cabecera.
 *
 * ── El mecanismo ──────────────────────────────────────────────────────────
 *
 * `normalize("NFKD")`, la descomposición de **compatibilidad**, aplicada
 * carácter a carácter y **solo** a los que son letras matemáticas. NFKD ya
 * sabe que 𝐀, 𝖠, 𝒜, 𝔄, 𝔸 y 𝙰 son la misma "A" con distinta pinta, así que no
 * hay que escribir catorce tablas de rangos ni mantenerlas cuando Unicode
 * añada una familia nueva.
 *
 * ⚠️ Nunca sobre la cadena entera. NFKD global convertiría ﬁ en "fi", ① en
 * "1", ² en "2" y ㎡ en "m2": eso ya no es limpiar formato, es reescribir el
 * contenido del usuario. La comprobación de rango es exactamente lo que separa
 * una cosa de la otra, y por eso va carácter a carácter.
 *
 * Las diacríticas del español **se conservan**: solo se eliminan las dos marcas
 * que este motor añade como estilo. Una tilde que el usuario escribió es
 * contenido, no formato.
 *
 * Es lo que usará "Limpiar formato" y, en el S04, lo que normalizará el texto
 * pegado antes de que entre al modelo.
 *
 * Aquí sí se recompone con NFC, y no por simetría con `toStyled`. Al devolver
 * las bases a ASCII queda texto latino corriente, donde "a" + U+0301 sí tiene
 * forma precompuesta; sin recomponer, `stripStyling(toStyled("á"))` devolvería
 * dos codepoints en lugar de uno: idéntico en pantalla, distinto para `===`.
 * NFC deja la salida en la forma canónica normal, que es la que espera
 * cualquier consumidor.
 */
export function stripStyling(text) {
  if (typeof text !== "string" || text === "") return "";

  let result = "";
  for (const point of text) {
    if (point === COMBINING.UNDERLINE || point === COMBINING.STRIKETHROUGH) {
      continue;
    }
    result += isMathAlphanumeric(point.codePointAt(0))
      ? point.normalize("NFKD")
      : point;
  }

  return result.normalize("NFC");
}

/**
 * ¿Este carácter tiene equivalente en algún bloque matemático?
 *
 * Mira la letra base tras descomponer, así que "á" es estilizable aunque el
 * bloque no contenga ninguna vocal acentuada. Los dígitos lo son porque existen
 * en negrita. Las secuencias de emoji no, aunque empiecen por un dígito.
 *
 * @param {string} char Un solo carácter o grafema. Si llega más de uno, se
 *   evalúa el primero.
 * @returns {boolean}
 */
export function isStyleable(char) {
  if (typeof char !== "string" || char === "") return false;
  if (isEmojiSequence(char)) return false;

  const [base] = char.normalize("NFD");
  if (base === undefined) return false;

  // El bloque de negrita es el que más cubre: es el único con dígitos.
  return shiftToBlock(base.codePointAt(0), BLOCKS.bold, true) !== null;
}
