/**
 * Tests del serializador Unicode (S03 tarea 4).
 *
 * Runner nativo de Node (`node --test`), sin librerías: `pnpm test`.
 *
 * Los puntos de inicio de los bloques se escriben aquí **a mano**, copiados de
 * la tabla de ADR-004, en lugar de importarlos de `blocks.js`. Es deliberado:
 * si el test leyera las mismas constantes que la implementación, una constante
 * equivocada pasaría desapercibida porque los dos lados se equivocarían igual.
 * Escribiéndolas dos veces, el test comprueba de verdad la tabla de la ADR.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  toStyled,
  stripStyling,
  isStyleable,
} from "../public/static/js/format/unicode.js";

// ── Constantes de referencia (ADR-004) ─────────────────────────────────────

const BOLD_UPPER = 0x1d5d4;
const BOLD_LOWER = 0x1d5ee;
const BOLD_DIGITS = 0x1d7ec;
const ITALIC_UPPER = 0x1d608;
const ITALIC_LOWER = 0x1d622;
const BOLD_ITALIC_UPPER = 0x1d63c;
const BOLD_ITALIC_LOWER = 0x1d656;

const ACUTE = String.fromCodePoint(0x0301);
const TILDE = String.fromCodePoint(0x0303);
const DIAERESIS = String.fromCodePoint(0x0308);
const UNDERLINE = String.fromCodePoint(0x0332);
const STRIKETHROUGH = String.fromCodePoint(0x0336);

const BOLD = { bold: true };
const ITALIC = { italic: true };
const BOLD_ITALIC = { bold: true, italic: true };
const UNDER = { underline: true };
const STRIKE = { strikethrough: true };
const TODO = {
  bold: true,
  italic: true,
  underline: true,
  strikethrough: true,
};

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

/** Construye el rango consecutivo de `length` caracteres desde `start`. */
function rangeFrom(start, length) {
  return Array.from({ length }, (_, i) =>
    String.fromCodePoint(start + i),
  ).join("");
}

/** La letra `base` (a–z o A–Z) desplazada al bloque que arranca en `start`. */
function shifted(base, start) {
  const anchor = base === base.toUpperCase() ? 0x41 : 0x61;
  return String.fromCodePoint(start + base.codePointAt(0) - anchor);
}

/**
 * Corpus en español de verdad. Se usa entero en reversibilidad e idempotencia,
 * así que cada frase que se añada aquí endurece esas dos garantías.
 */
const CORPUS = [
  "Hola mundo",
  "¿Cómo estás? ¡Qué alegría verte por aquí!",
  "El señor Muñoz añadió 42 ideas y 3 preguntas al informe.",
  "La niña jugaba en el jardín mientras el búho la miraba en silencio.",
  "Coração, naïve, garçon: à ê ï õ ç también atraviesan la función.",
  "Publicar en LinkedIn 😀 con la familia 👨‍👩‍👧 y la bandera 🇨🇱",
  "Precio: 19 € — «una ganga», dijo. º ª ¡Ojo con el cambio!",
  "Primera línea\nSegunda línea\tcon tabulador",
  "",
];

const ESTILOS = [
  {},
  BOLD,
  ITALIC,
  BOLD_ITALIC,
  UNDER,
  STRIKE,
  { bold: true, underline: true },
  { italic: true, strikethrough: true },
  TODO,
];

// ── Abecedario ─────────────────────────────────────────────────────────────

describe("abecedario", () => {
  test("los bloques arrancan donde dice ADR-004", () => {
    assert.equal(toStyled("A", BOLD).codePointAt(0), BOLD_UPPER);
    assert.equal(toStyled("a", BOLD).codePointAt(0), BOLD_LOWER);
    assert.equal(toStyled("A", ITALIC).codePointAt(0), ITALIC_UPPER);
    assert.equal(toStyled("a", ITALIC).codePointAt(0), ITALIC_LOWER);
    assert.equal(toStyled("A", BOLD_ITALIC).codePointAt(0), BOLD_ITALIC_UPPER);
    assert.equal(toStyled("a", BOLD_ITALIC).codePointAt(0), BOLD_ITALIC_LOWER);
    assert.equal(toStyled("0", BOLD).codePointAt(0), BOLD_DIGITS);
  });

  test("a–z completo en los tres estilos", () => {
    assert.equal(toStyled(LOWERCASE, BOLD), rangeFrom(BOLD_LOWER, 26));
    assert.equal(toStyled(LOWERCASE, ITALIC), rangeFrom(ITALIC_LOWER, 26));
    assert.equal(
      toStyled(LOWERCASE, BOLD_ITALIC),
      rangeFrom(BOLD_ITALIC_LOWER, 26),
    );
  });

  test("A–Z completo en los tres estilos", () => {
    assert.equal(toStyled(UPPERCASE, BOLD), rangeFrom(BOLD_UPPER, 26));
    assert.equal(toStyled(UPPERCASE, ITALIC), rangeFrom(ITALIC_UPPER, 26));
    assert.equal(
      toStyled(UPPERCASE, BOLD_ITALIC),
      rangeFrom(BOLD_ITALIC_UPPER, 26),
    );
  });

  test("ninguna letra cae en un codepoint no asignado", () => {
    // El motivo de ADR-004: en los bloques serif la "h" cursiva es un hueco.
    // Aquí se comprueba que los 26 + 26 de cada bloque existen de verdad.
    for (const style of [BOLD, ITALIC, BOLD_ITALIC]) {
      for (const letra of LOWERCASE + UPPERCASE) {
        const salida = toStyled(letra, style);
        assert.equal([...salida].length, 1, `${letra} produjo más de un punto`);
        assert.notEqual(salida, letra, `${letra} no se transformó`);
      }
    }
  });
});

// ── Dígitos ────────────────────────────────────────────────────────────────

describe("dígitos", () => {
  test("0–9 transforman en negrita", () => {
    assert.equal(toStyled(DIGITS, BOLD), rangeFrom(BOLD_DIGITS, 10));
  });

  test("0–9 NO transforman en cursiva: Unicode no los define", () => {
    assert.equal(toStyled(DIGITS, ITALIC), DIGITS);
  });

  test("en negrita-cursiva el dígito recibe solo la negrita", () => {
    assert.equal(toStyled(DIGITS, BOLD_ITALIC), rangeFrom(BOLD_DIGITS, 10));
  });

  test("el dígito en cursiva sigue admitiendo subrayado", () => {
    assert.equal(
      toStyled("7", { italic: true, underline: true }),
      "7" + UNDERLINE,
    );
  });
});

// ── Español ────────────────────────────────────────────────────────────────

describe("español", () => {
  // [carácter, letra base, marca combinable esperada]
  const ACENTUADAS = [
    ["á", "a", ACUTE],
    ["é", "e", ACUTE],
    ["í", "i", ACUTE],
    ["ó", "o", ACUTE],
    ["ú", "u", ACUTE],
    ["ü", "u", DIAERESIS],
    ["ñ", "n", TILDE],
  ];

  test("minúsculas acentuadas en negrita y cursiva", () => {
    for (const [caracter, base, marca] of ACENTUADAS) {
      assert.equal(
        toStyled(caracter, BOLD),
        shifted(base, BOLD_LOWER) + marca,
        `${caracter} en negrita`,
      );
      assert.equal(
        toStyled(caracter, ITALIC),
        shifted(base, ITALIC_LOWER) + marca,
        `${caracter} en cursiva`,
      );
    }
  });

  test("mayúsculas acentuadas en negrita y cursiva", () => {
    for (const [caracter, base, marca] of ACENTUADAS) {
      const mayuscula = caracter.toUpperCase();
      const baseMayuscula = base.toUpperCase();
      assert.equal(
        toStyled(mayuscula, BOLD),
        shifted(baseMayuscula, BOLD_UPPER) + marca,
        `${mayuscula} en negrita`,
      );
      assert.equal(
        toStyled(mayuscula, ITALIC),
        shifted(baseMayuscula, ITALIC_UPPER) + marca,
        `${mayuscula} en cursiva`,
      );
    }
  });

  test("da igual que la entrada llegue precompuesta o descompuesta", () => {
    const precompuesta = "á";
    const descompuesta = "a" + ACUTE;
    assert.equal(toStyled(precompuesta, BOLD), toStyled(descompuesta, BOLD));
  });

  test("una frase entera conserva sus tildes", () => {
    const frase = "El señor Muñoz añadió más ideas";
    assert.equal(stripStyling(toStyled(frase, BOLD)), frase);
  });
});

// ── Diacríticas ajenas al español ──────────────────────────────────────────

describe("diacríticas ajenas", () => {
  test("à ê ï õ ç funcionan sin haberlas listado en ninguna tabla", () => {
    for (const caracter of ["à", "ê", "ï", "õ", "ç"]) {
      const salida = toStyled(caracter, BOLD);

      // Dos codepoints: la base matemática y su marca.
      assert.equal([...salida].length, 2, `${caracter} no se descompuso`);

      // La base cayó dentro del bloque de negrita minúscula.
      const base = salida.codePointAt(0);
      assert.ok(
        base >= BOLD_LOWER && base < BOLD_LOWER + 26,
        `${caracter} no aterrizó en el bloque de negrita`,
      );

      assert.equal(stripStyling(salida), caracter);
    }
  });
});

// ── Caracteres sin mapeo ───────────────────────────────────────────────────

describe("sin mapeo", () => {
  const SIN_MAPEO = "¿¡ºª«»€";

  test("salen idénticos en todos los estilos de bloque", () => {
    for (const style of [BOLD, ITALIC, BOLD_ITALIC]) {
      assert.equal(toStyled(SIN_MAPEO, style), SIN_MAPEO);
    }
  });

  test("guiones y comillas tipográficas también", () => {
    const tipografia = "— – “ ” ‘ ’ …";
    assert.equal(toStyled(tipografia, BOLD), tipografia);
  });
});

// ── Emojis ─────────────────────────────────────────────────────────────────

describe("emojis", () => {
  test("😀 y 👨‍👩‍👧 atraviesan intactos", () => {
    // Este es el test que falla si alguien usó split("").
    for (const emoji of ["😀", "👨‍👩‍👧"]) {
      for (const style of [BOLD, ITALIC, BOLD_ITALIC]) {
        assert.equal(toStyled(emoji, style), emoji);
      }
    }
  });

  test("banderas, tonos de piel y teclas no se rompen", () => {
    for (const emoji of ["🇨🇱", "👍🏽", "1️⃣"]) {
      assert.equal(toStyled(emoji, BOLD), emoji);
    }
  });

  test("un emoji en mitad de una frase no arrastra a sus vecinos", () => {
    const salida = toStyled("va 😀 bien", BOLD);
    assert.ok(salida.includes("😀"));
    assert.equal(stripStyling(salida), "va 😀 bien");
  });
});

// ── Espacios y vacío ───────────────────────────────────────────────────────

describe("espacios y vacío", () => {
  test("espacios, tabuladores y saltos de línea intactos", () => {
    const blancos = " \t\n\r ";
    assert.equal(toStyled(blancos, BOLD), blancos);
  });

  test("toStyled('') devuelve ''", () => {
    for (const style of ESTILOS) {
      assert.equal(toStyled("", style), "");
    }
  });

  test("stripStyling('') devuelve ''", () => {
    assert.equal(stripStyling(""), "");
  });
});

// ── Subrayado y tachado ────────────────────────────────────────────────────

describe("subrayado y tachado", () => {
  test("cada letra recibe su marca", () => {
    assert.equal(toStyled("ab", UNDER), "a" + UNDERLINE + "b" + UNDERLINE);
    assert.equal(
      toStyled("ab", STRIKE),
      "a" + STRIKETHROUGH + "b" + STRIKETHROUGH,
    );
  });

  test("se combinan con la negrita", () => {
    assert.equal(
      toStyled("a", { bold: true, underline: true }),
      shifted("a", BOLD_LOWER) + UNDERLINE,
    );
  });

  test("se combinan entre sí", () => {
    const salida = toStyled("a", { underline: true, strikethrough: true });
    assert.ok(salida.includes(UNDERLINE));
    assert.ok(salida.includes(STRIKETHROUGH));
    assert.equal(stripStyling(salida), "a");
  });

  test("los espacios sí se subrayan, para que la línea salga continua", () => {
    assert.equal(toStyled("a b", UNDER).split(UNDERLINE).length - 1, 3);
  });

  test("el salto de línea no recibe marca: quedaría flotando", () => {
    const salida = toStyled("uno\ndos", UNDER);
    assert.ok(!salida.includes("\n" + UNDERLINE));
  });

  test("alcanzan a caracteres que la negrita no puede tocar", () => {
    assert.equal(toStyled("€", UNDER), "€" + UNDERLINE);
  });
});

// ── Idempotencia ───────────────────────────────────────────────────────────

describe("idempotencia", () => {
  test("aplicar el mismo estilo dos veces da el mismo resultado que una", () => {
    for (const texto of CORPUS) {
      for (const style of ESTILOS) {
        const unaVez = toStyled(texto, style);
        assert.equal(
          toStyled(unaVez, style),
          unaVez,
          `estilo ${JSON.stringify(style)} sobre ${JSON.stringify(texto)}`,
        );
      }
    }
  });

  test("stripStyling de texto ya limpio no lo cambia", () => {
    for (const texto of CORPUS) {
      assert.equal(stripStyling(stripStyling(texto)), stripStyling(texto));
    }
  });
});

// ── Reversibilidad ─────────────────────────────────────────────────────────

describe("reversibilidad", () => {
  test("stripStyling(toStyled(x, estilo)) === x para todo el corpus", () => {
    for (const texto of CORPUS) {
      for (const style of ESTILOS) {
        assert.equal(
          stripStyling(toStyled(texto, style)),
          texto,
          `estilo ${JSON.stringify(style)} sobre ${JSON.stringify(texto)}`,
        );
      }
    }
  });

  test("stripStyling conserva las tildes: son contenido, no formato", () => {
    const acentuado = "canción francés güero";
    assert.equal(stripStyling(acentuado), acentuado);
  });

  test("stripStyling limpia texto pegado desde otra herramienta", () => {
    // Mezcla de los tres bloques y las dos marcas, como llegaría de fuera.
    const pegado =
      shifted("H", BOLD_UPPER) +
      shifted("o", ITALIC_LOWER) +
      shifted("l", BOLD_ITALIC_LOWER) +
      "a" +
      UNDERLINE +
      STRIKETHROUGH;
    assert.equal(stripStyling(pegado), "Hola");
  });
});

// ── isStyleable ────────────────────────────────────────────────────────────

describe("isStyleable", () => {
  test("true para letras, acentuadas y dígitos", () => {
    for (const caracter of ["a", "Z", "á", "ñ", "ü", "ç", "7"]) {
      assert.equal(isStyleable(caracter), true, caracter);
    }
  });

  test("false para lo que no tiene mapeo", () => {
    for (const caracter of ["¿", "¡", "€", "—", " ", "\n", "😀", "1️⃣", ""]) {
      assert.equal(isStyleable(caracter), false, JSON.stringify(caracter));
    }
  });
});
