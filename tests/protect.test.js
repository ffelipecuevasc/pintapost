/**
 * Tests de la detección de hashtags y menciones (S05 tarea 2, B-17, ADR-013).
 *
 * Dos clases de fallo, y las dos cuestan alcance real al usuario:
 *
 *   Falso negativo — un hashtag que no se detecta recibe formato Unicode, deja
 *   de ser un enlace azul en LinkedIn y no agrupa con los demás.
 *
 *   Falso positivo — un tramo protegido de más se queda en redonda en mitad de
 *   una frase en negrita, sin que nada lo explique.
 *
 * El caso del correo electrónico está en los dos lados a la vez y por eso
 * aparece varias veces aquí: `hola@ejemplo.com` no es una mención, pero la
 * arroba es la misma.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { findProtected } from "../public/static/js/export/protect.js";

/** Los tramos encontrados, ya recortados del texto: se leen mucho mejor. */
const found = (text) =>
  findProtected(text).map(({ start, end }) => text.slice(start, end));

describe("hashtags", () => {
  test("un hashtag en medio de la frase", () => {
    assert.deepEqual(found("Hablemos de #Marketing hoy"), ["#Marketing"]);
  });

  test("un hashtag al principio del texto", () => {
    assert.deepEqual(found("#Marketing es lo de hoy"), ["#Marketing"]);
  });

  test("un hashtag al final del texto", () => {
    assert.deepEqual(found("Todo sobre #Marketing"), ["#Marketing"]);
  });

  test("dos hashtags seguidos se detectan los dos", () => {
    assert.deepEqual(found("#Marketing #Ventas"), ["#Marketing", "#Ventas"]);
  });

  test("varios hashtags al final del post, el patrón habitual en LinkedIn", () => {
    assert.deepEqual(found("Buen día.\n\n#Marketing #Ventas #Growth"), [
      "#Marketing",
      "#Ventas",
      "#Growth",
    ]);
  });

  test("acepta letras acentuadas: #Diseño", () => {
    assert.deepEqual(found("Sobre #Diseño y nada más"), ["#Diseño"]);
  });

  test("acepta letras y números mezclados: #Año2026", () => {
    assert.deepEqual(found("Metas para #Año2026 ya"), ["#Año2026"]);
  });

  test("acepta guiones y guiones bajos", () => {
    assert.deepEqual(found("#growth_hacking y #data-science"), [
      "#growth_hacking",
      "#data-science",
    ]);
  });

  test("la puntuación de después no entra en el hashtag", () => {
    assert.deepEqual(found("Hablemos de #Marketing, ¿vale?"), ["#Marketing"]);
    assert.deepEqual(found("Todo sobre #Ventas."), ["#Ventas"]);
  });

  test("un hashtag tras un salto de línea se detecta", () => {
    assert.deepEqual(found("Primera línea\n#Marketing"), ["#Marketing"]);
  });
});

describe("menciones", () => {
  test("una mención en medio de la frase", () => {
    assert.deepEqual(found("Gracias a @ana por la idea"), ["@ana"]);
  });

  test("una mención al principio del texto", () => {
    assert.deepEqual(found("@ana tenía razón"), ["@ana"]);
  });

  test("una mención con nombre compuesto por guion", () => {
    assert.deepEqual(found("Con @maria-lopez en el equipo"), ["@maria-lopez"]);
  });

  test("hashtags y menciones conviven en el mismo texto", () => {
    assert.deepEqual(found("@ana habló de #Marketing con @luis"), [
      "@ana",
      "#Marketing",
      "@luis",
    ]);
  });
});

describe("lo que NO es un hashtag ni una mención", () => {
  test("un correo electrónico no es una mención", () => {
    assert.deepEqual(found("Escríbeme a hola@ejemplo.com"), []);
  });

  test("un correo en medio de un texto con menciones de verdad", () => {
    assert.deepEqual(found("@ana escribe a hola@ejemplo.com y avisa a @luis"), [
      "@ana",
      "@luis",
    ]);
  });

  test("una almohadilla suelta no es nada", () => {
    assert.deepEqual(found("El número # está solo"), []);
  });

  test("una arroba suelta no es nada", () => {
    assert.deepEqual(found("La arroba @ está sola"), []);
  });

  test("una almohadilla seguida de un símbolo no es nada", () => {
    assert.deepEqual(found("Vale #! y también #."), []);
  });

  test("una almohadilla pegada a una palabra por la izquierda no cuenta", () => {
    // `C#` es un lenguaje, no el principio de un hashtag; y en `uno#dos` la
    // almohadilla no abre nada.
    assert.deepEqual(found("Programo en C#Sharp"), []);
    assert.deepEqual(found("uno#dos"), []);
  });

  test("dos hashtags pegados sin espacio: solo cuenta el primero", () => {
    assert.deepEqual(found("#uno#dos"), ["#uno"]);
  });

  test("un texto sin nada devuelve una lista vacía", () => {
    assert.deepEqual(findProtected("Un post normal y corriente"), []);
  });

  test("una cadena vacía o algo que no es cadena devuelve una lista vacía", () => {
    assert.deepEqual(findProtected(""), []);
    assert.deepEqual(findProtected(null), []);
    assert.deepEqual(findProtected(undefined), []);
    assert.deepEqual(findProtected(42), []);
  });
});

describe("los tramos que devuelve", () => {
  test("los offsets recortan exactamente el hashtag", () => {
    const text = "Hola #Marketing mundo";
    assert.deepEqual(findProtected(text), [{ start: 5, end: 15 }]);
    assert.equal(text.slice(5, 15), "#Marketing");
  });

  test("vienen ordenados y sin solapes", () => {
    const tramos = findProtected("#uno y #dos y luego @tres al final");

    for (let i = 1; i < tramos.length; i += 1) {
      assert.ok(tramos[i].start >= tramos[i - 1].end);
    }
  });

  test("llamarla dos veces da el mismo resultado", () => {
    // La expresión regular es global y de módulo: su `lastIndex` es estado
    // compartido. Si no se reiniciara, la segunda llamada empezaría a buscar
    // donde acabó la primera y devolvería menos tramos.
    const text = "Hablemos de #Marketing con @ana";
    assert.deepEqual(findProtected(text), findProtected(text));
  });

  test("los offsets van en unidades UTF-16, como el modelo (ADR-019)", () => {
    // El emoji ocupa 2 unidades: si la función contara codepoints, el tramo
    // saldría desplazado una posición a la izquierda.
    const text = "Hola 😀 #Marketing";
    const [tramo] = findProtected(text);

    assert.equal(text.slice(tramo.start, tramo.end), "#Marketing");
    assert.equal(tramo.start, text.indexOf("#"));
  });
});
