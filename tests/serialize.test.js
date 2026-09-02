/**
 * Tests del serializador (S05 tarea 3, B-13).
 *
 * `serialize` es la salida del producto: lo que aquí se produzca es
 * literalmente lo que el usuario pega en LinkedIn. Tres garantías, por orden de
 * importancia:
 *
 *   1. **Reversibilidad.** `stripStyling(serialize(m)) === m.text` para todo el
 *      corpus. Es el cierre del círculo: lo que sale se puede volver a limpiar
 *      y da exactamente lo que había. Si esto falla, el motor está perdiendo o
 *      inventando caracteres del texto del usuario.
 *   2. **ADR-013.** Un hashtag dentro de un tramo en negrita sale sin formato,
 *      porque de eso depende que siga siendo un enlace en LinkedIn.
 *   3. **Acuerdo con lo que se ve.** El serializador usa la misma partición que
 *      el renderizador, así que los tramos de estilo no pueden salir corridos.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createModel } from "../public/static/js/editor/model.js";
import { serialize } from "../public/static/js/export/serialize.js";
import {
  stripStyling,
  toStyled,
} from "../public/static/js/format/unicode.js";
import { count } from "../public/static/js/format/counting.js";

const r = (start, end, style) => ({ start, end, style });

/**
 * Corpus en español de verdad, con lo que de hecho aparece en un post de
 * LinkedIn: tildes, eñes, signos de apertura, emojis, saltos de línea,
 * hashtags y menciones. Cada frase que se añada aquí endurece la garantía de
 * reversibilidad.
 *
 * Va en NFC porque `stripStyling` recompone con NFC al terminar: comparar
 * contra un original descompuesto fallaría por una diferencia que no está en el
 * contenido sino en su forma de escribirse.
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
  "Hablemos de #Marketing y de #Diseño con @ana y @luis-perez",
  "Escríbeme a hola@ejemplo.com para el #Año2026",
  "Un post normal.\n\nCon dos párrafos y un cierre.\n\n#Growth #Ventas",
  "",
].map((text) => text.normalize("NFC"));

/** Todas las combinaciones de estilo que la interfaz puede producir. */
const ESTILOS = [
  [],
  ["bold"],
  ["italic"],
  ["bold", "italic"],
  ["underline"],
  ["strikethrough"],
  ["bold", "underline"],
  ["italic", "strikethrough"],
  ["bold", "italic", "underline", "strikethrough"],
];

/** Un modelo con `styles` aplicados a todo el texto. */
const todoCon = (text, styles) =>
  createModel(
    text,
    styles.map((style) => r(0, text.length, style)),
  );

describe("casos básicos", () => {
  test("un modelo vacío devuelve la cadena vacía", () => {
    assert.equal(serialize(createModel()), "");
  });

  test("un modelo sin estilos devuelve el texto idéntico", () => {
    const texto = "Hola mundo, ¿qué tal?";
    assert.equal(serialize(createModel(texto)), texto);
  });

  test("un modelo sin la propiedad ranges no rompe", () => {
    assert.equal(serialize({ text: "Hola" }), "Hola");
  });

  test("negrita sobre todo el texto es lo mismo que toStyled", () => {
    const texto = "Hola mundo";
    assert.equal(
      serialize(todoCon(texto, ["bold"])),
      toStyled(texto, { bold: true }),
    );
  });

  test("no muta el modelo", () => {
    const modelo = createModel("Hola #tag mundo", [r(0, 15, "bold")]);
    const copia = structuredClone(modelo);
    serialize(modelo);
    assert.deepEqual(modelo, copia);
  });
});

describe("tramos y solapamientos", () => {
  test("la negrita parcial afecta solo a su tramo", () => {
    const modelo = createModel("Hola mundo", [r(5, 10, "bold")]);
    assert.equal(serialize(modelo), "Hola " + toStyled("mundo", { bold: true }));
  });

  test("los estilos solapados producen negrita-cursiva en la intersección", () => {
    // Negrita 0–10, cursiva 5–15. El tramo 5–10 lleva los dos.
    const modelo = createModel("0123456789abcde", [
      r(0, 10, "bold"),
      r(5, 15, "italic"),
    ]);

    assert.equal(
      serialize(modelo),
      toStyled("01234", { bold: true }) +
        toStyled("56789", { bold: true, italic: true }) +
        toStyled("abcde", { italic: true }),
    );
  });

  test("dos rangos del mismo estilo con un hueco dejan el hueco en plano", () => {
    const modelo = createModel("uno dos tres", [r(0, 3, "bold"), r(8, 12, "bold")]);
    assert.equal(
      serialize(modelo),
      toStyled("uno", { bold: true }) + " dos " + toStyled("tres", { bold: true }),
    );
  });

  test("el subrayado marca cada letra de su tramo y ninguna más", () => {
    const modelo = createModel("abc def", [r(0, 3, "underline")]);
    assert.equal(serialize(modelo), toStyled("abc", { underline: true }) + " def");
  });
});

describe("hashtags y menciones (ADR-013)", () => {
  test("un hashtag dentro de un tramo en negrita sale sin formato", () => {
    const modelo = createModel("Hola #Marketing mundo", [r(0, 21, "bold")]);

    assert.equal(
      serialize(modelo),
      toStyled("Hola ", { bold: true }) +
        "#Marketing" +
        toStyled(" mundo", { bold: true }),
    );
  });

  test("el hashtag sale literal aunque lleve los cuatro estilos", () => {
    const texto = "#Marketing";
    const modelo = todoCon(texto, [
      "bold",
      "italic",
      "underline",
      "strikethrough",
    ]);

    assert.equal(serialize(modelo), texto);
  });

  test("una mención dentro de un tramo en cursiva sale sin formato", () => {
    const modelo = createModel("Gracias a @ana por todo", [r(0, 23, "italic")]);

    assert.equal(
      serialize(modelo),
      toStyled("Gracias a ", { italic: true }) +
        "@ana" +
        toStyled(" por todo", { italic: true }),
    );
  });

  test("un correo dentro de un tramo en negrita SÍ recibe formato", () => {
    // No es una mención, así que no hay motivo para protegerlo.
    const texto = "hola@ejemplo.com";
    assert.equal(
      serialize(todoCon(texto, ["bold"])),
      toStyled(texto, { bold: true }),
    );
  });

  test("varios hashtags al final del post salen todos literales", () => {
    const texto = "Buen día.\n\n#Marketing #Ventas";
    const salida = serialize(todoCon(texto, ["bold"]));

    assert.ok(salida.includes("#Marketing"));
    assert.ok(salida.includes("#Ventas"));
    assert.ok(salida.startsWith(toStyled("Buen día.", { bold: true })));
  });

  test("el texto protegido no lleva ni subrayado ni tachado", () => {
    const modelo = todoCon("uno #tag", ["underline", "strikethrough"]);
    const salida = serialize(modelo);

    assert.ok(salida.endsWith("#tag"));
  });
});

describe("saltos de línea", () => {
  test("un salto de línea dentro de un tramo subrayado no lleva la marca", () => {
    // Si el salto la llevara, el subrayado se arrastraría al renglón siguiente
    // en algunos clientes: la marca combinable no tiene sobre qué dibujarse y
    // aparece flotando al principio de la línea.
    const salida = serialize(todoCon("uno\ndos", ["underline"]));

    assert.equal(salida.split("\n").length, 2);
    assert.equal(salida.includes("\n̲"), false);
    assert.equal(salida.includes("̲\n̲"), false);
  });

  test("lo mismo con el tachado", () => {
    const salida = serialize(todoCon("uno\ndos", ["strikethrough"]));
    assert.equal(salida.includes("\n̶"), false);
  });

  test("los saltos de línea se conservan todos y en su sitio", () => {
    const texto = "uno\n\ndos\ntres";
    const salida = serialize(todoCon(texto, ["bold"]));

    assert.equal([...salida].filter((c) => c === "\n").length, 3);
    assert.equal(stripStyling(salida), texto);
  });
});

describe("máxima compatibilidad (ADR-018)", () => {
  test("con styleCombining false las vocales acentuadas quedan en plano", () => {
    const modelo = todoCon("Cómo", ["bold"]);
    const salida = serialize(modelo, { styleCombining: false });

    assert.ok(salida.includes("ó"));
    assert.equal(salida, toStyled("Cómo", { bold: true, styleCombining: false }));
  });

  test("el resultado ocupa menos unidades UTF-16 que con la opción activada", () => {
    const modelo = todoCon("¿Cómo estás? El señor Muñoz añadió más ideas.", [
      "bold",
    ]);

    const conEstilo = serialize(modelo, { styleCombining: true }).length;
    const sinEstilo = serialize(modelo, { styleCombining: false }).length;

    assert.ok(sinEstilo < conEstilo);
    // Exactamente 2 unidades por letra con diacrítica, y en la frase hay 7:
    // ó, á, ñ, ñ, ñ, ó, á. Es la aritmética de ADR-018, que es también la razón
    // de que el ahorro real sea del 3 % y no del 10-15 % que se estimó.
    assert.equal(conEstilo - sinEstilo, 14);
  });

  test("por defecto la opción va activada: el defecto es el estilo compuesto", () => {
    const modelo = todoCon("Cómo", ["bold"]);
    assert.equal(serialize(modelo), serialize(modelo, { styleCombining: true }));
  });

  test("las letras sin diacrítica sí reciben estilo en los dos modos", () => {
    const salida = serialize(todoCon("Cómo", ["bold"]), {
      styleCombining: false,
    });
    assert.equal(salida.startsWith(toStyled("C", { bold: true })), true);
  });

  test("el subrayado se aplica en los dos modos", () => {
    const salida = serialize(todoCon("á", ["underline"]), {
      styleCombining: false,
    });
    assert.ok(salida.includes("̲"));
  });
});

describe("el cierre del círculo: reversibilidad sobre el corpus", () => {
  test("stripStyling(serialize(m)) === m.text sin estilos", () => {
    for (const texto of CORPUS) {
      assert.equal(stripStyling(serialize(createModel(texto))), texto);
    }
  });

  test("stripStyling(serialize(m)) === m.text en las nueve combinaciones", () => {
    for (const texto of CORPUS) {
      for (const styles of ESTILOS) {
        assert.equal(
          stripStyling(serialize(todoCon(texto, styles))),
          texto,
          `falló "${texto}" con [${styles.join(", ")}]`,
        );
      }
    }
  });

  test("y también con la opción de máxima compatibilidad", () => {
    for (const texto of CORPUS) {
      for (const styles of ESTILOS) {
        assert.equal(
          stripStyling(serialize(todoCon(texto, styles), { styleCombining: false })),
          texto,
          `falló "${texto}" con [${styles.join(", ")}]`,
        );
      }
    }
  });

  test("con estilos parciales, que es el caso real", () => {
    for (const texto of CORPUS) {
      if (texto.length < 6) continue;

      const mitad = Math.floor(texto.length / 2);
      const modelo = createModel(texto, [
        r(0, mitad, "bold"),
        r(Math.floor(mitad / 2), texto.length, "italic"),
      ]);

      assert.equal(stripStyling(serialize(modelo)), texto, `falló "${texto}"`);
    }
  });
});

describe("acuerdo con el contador (ADR-012)", () => {
  test("el texto plano y el serializado miden distinto, y esa es la razón del contador dual", () => {
    const texto = "El señor Muñoz añadió 42 ideas";
    const modelo = todoCon(texto, ["bold"]);

    const plano = count(texto);
    const serializado = count(serialize(modelo));

    // Los grafemas no cambian: el usuario ve las mismas letras.
    assert.equal(serializado.graphemes, plano.graphemes);
    // Las unidades UTF-16 sí, que es lo que cuenta LinkedIn.
    assert.ok(serializado.utf16 > plano.utf16);
  });
});
