/**
 * Tests del contador de longitudes (S03 tarea 4).
 *
 * Lo que se comprueba aquí no es aritmética por gusto: es la evidencia de que
 * las tres medidas se separan de verdad en cuanto aparece un carácter
 * matemático, que es la premisa del contador dual de ADR-012.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { count } from "../public/static/js/format/counting.js";
import { toStyled } from "../public/static/js/format/unicode.js";

const ACUTE = String.fromCodePoint(0x0301);

describe("las tres medidas", () => {
  test("en texto ASCII las tres coinciden", () => {
    assert.deepEqual(count("Hola"), {
      utf16: 4,
      codepoints: 4,
      graphemes: 4,
    });
  });

  test("una tilde precompuesta cuenta uno en las tres", () => {
    assert.deepEqual(count("á"), { utf16: 1, codepoints: 1, graphemes: 1 });
  });

  test("la misma tilde descompuesta separa codepoints de grafemas", () => {
    assert.deepEqual(count("a" + ACUTE), {
      utf16: 2,
      codepoints: 2,
      graphemes: 1,
    });
  });

  test("un emoji fuera del BMP separa utf16 de codepoints", () => {
    assert.deepEqual(count("😀"), { utf16: 2, codepoints: 1, graphemes: 1 });
  });

  test("una familia con ZWJ separa las tres", () => {
    assert.deepEqual(count("👨‍👩‍👧"), {
      utf16: 8,
      codepoints: 5,
      graphemes: 1,
    });
  });

  test("una bandera son dos indicadores regionales y un solo grafema", () => {
    assert.deepEqual(count("🇨🇱"), { utf16: 4, codepoints: 2, graphemes: 1 });
  });
});

describe("el caso de ADR-012", () => {
  test('una "á" en negrita ocupa 3 unidades UTF-16, 2 codepoints y 1 grafema', () => {
    assert.deepEqual(count(toStyled("á", { bold: true })), {
      utf16: 3,
      codepoints: 2,
      graphemes: 1,
    });
  });

  test("estilizar no cambia lo que el usuario percibe como letras", () => {
    const post = "Hoy aprendí algo que me cambió la forma de escribir.";
    assert.equal(
      count(toStyled(post, { bold: true })).graphemes,
      count(post).graphemes,
    );
  });

  test("pero casi duplica lo que cuenta LinkedIn si cuenta por UTF-16", () => {
    const post = "Hoy aprendí algo que me cambió la forma de escribir.";
    const plano = count(post);
    const negrita = count(toStyled(post, { bold: true }));

    // El factor real ronda 1,8x por las tildes; basta con exigir que crezca
    // de forma sustancial para que el test no dependa de la frase exacta.
    assert.ok(
      negrita.utf16 > plano.utf16 * 1.5,
      `esperaba un crecimiento notable, obtuve ${negrita.utf16}/${plano.utf16}`,
    );
  });
});

describe("invariantes", () => {
  const MUESTRAS = [
    "",
    "Hola",
    "¿Cómo estás?",
    "El señor Muñoz añadió 42 ideas.",
    "😀 👨‍👩‍👧 🇨🇱 👍🏽",
    toStyled("Café con ñ y 42", { bold: true, underline: true }),
  ];

  test("graphemes ≤ codepoints ≤ utf16 siempre", () => {
    for (const texto of MUESTRAS) {
      const { utf16, codepoints, graphemes } = count(texto);
      assert.ok(graphemes <= codepoints, JSON.stringify(texto));
      assert.ok(codepoints <= utf16, JSON.stringify(texto));
    }
  });

  test("utf16 coincide con String.prototype.length", () => {
    for (const texto of MUESTRAS) {
      assert.equal(count(texto).utf16, texto.length);
    }
  });
});

describe("casos límite", () => {
  test("la cadena vacía da cero en las tres", () => {
    assert.deepEqual(count(""), { utf16: 0, codepoints: 0, graphemes: 0 });
  });

  test("lo que no es una cadena da cero en vez de lanzar", () => {
    for (const valor of [null, undefined, 42, {}, []]) {
      assert.deepEqual(count(valor), {
        utf16: 0,
        codepoints: 0,
        graphemes: 0,
      });
    }
  });
});

describe("degradación sin Intl.Segmenter", () => {
  test("cae a codepoints y no lanza (Safari antiguo)", async () => {
    const original = Intl.Segmenter;
    delete Intl.Segmenter;

    try {
      // La query hace que Node cargue una instancia nueva del módulo, con su
      // segmentador construido ya sin Intl.Segmenter disponible.
      const { count: countSinSegmenter } = await import(
        "../public/static/js/format/counting.js?sin-segmenter"
      );

      assert.deepEqual(countSinSegmenter("Hola"), {
        utf16: 4,
        codepoints: 4,
        graphemes: 4,
      });

      // Sin segmentador, la familia con ZWJ cuenta 5 en vez de 1: es la
      // aproximación esperada, no un fallo.
      assert.deepEqual(countSinSegmenter("👨‍👩‍👧"), {
        utf16: 8,
        codepoints: 5,
        graphemes: 5,
      });
    } finally {
      Intl.Segmenter = original;
    }
  });
});
