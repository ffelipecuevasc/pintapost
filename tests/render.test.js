/**
 * Tests del renderizador (S04 tarea 2).
 *
 * `render` es la única función del proyecto que construye marcado, así que dos
 * cosas se comprueban aquí con más insistencia que el resto: que los estilos
 * solapados salgan siempre con las etiquetas bien anidadas —el HTML no admite
 * cruces— y que el texto del usuario se escape sin excepción.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createModel } from "../public/static/js/editor/model.js";
import { render } from "../public/static/js/editor/render.js";

const r = (start, end, style) => ({ start, end, style });

describe("casos básicos", () => {
  test("el modelo vacío no produce marcado", () => {
    assert.equal(render(createModel()), "");
  });

  test("un texto sin estilos sale tal cual", () => {
    assert.equal(render(createModel("Hola mundo")), "Hola mundo");
  });

  test("un rango que cubre todo el texto lo envuelve entero", () => {
    const modelo = createModel("Hola", [r(0, 4, "bold")]);
    assert.equal(render(modelo), "<strong>Hola</strong>");
  });

  test("un rango en medio parte el texto en tres tramos", () => {
    const modelo = createModel("Hola mundo", [r(5, 10, "bold")]);
    assert.equal(render(modelo), "Hola <strong>mundo</strong>");
  });

  test("cada estilo usa su etiqueta semántica", () => {
    const modelo = createModel("abcd", [
      r(0, 1, "bold"),
      r(1, 2, "italic"),
      r(2, 3, "underline"),
      r(3, 4, "strikethrough"),
    ]);
    assert.equal(
      render(modelo),
      "<strong>a</strong><em>b</em><u>c</u><s>d</s>",
    );
  });
});

describe("estilos anidados y solapados", () => {
  test("dos estilos sobre el mismo tramo se anidan en el orden de STYLES", () => {
    const modelo = createModel("Hola", [r(0, 4, "italic"), r(0, 4, "bold")]);
    assert.equal(render(modelo), "<strong><em>Hola</em></strong>");
  });

  test("los cuatro estilos a la vez se anidan y se cierran al revés", () => {
    const modelo = createModel("A", [
      r(0, 1, "strikethrough"),
      r(0, 1, "underline"),
      r(0, 1, "italic"),
      r(0, 1, "bold"),
    ]);
    assert.equal(
      render(modelo),
      "<strong><em><u><s>A</s></u></em></strong>",
    );
  });

  test("un solapamiento parcial se parte en tres tramos sin cruzar etiquetas", () => {
    // Negrita 0–10 y cursiva 5–15: el caso del comentario de render.js.
    const modelo = createModel("0123456789abcde", [
      r(0, 10, "bold"),
      r(5, 15, "italic"),
    ]);
    assert.equal(
      render(modelo),
      "<strong>01234</strong>" +
        "<strong><em>56789</em></strong>" +
        "<em>abcde</em>",
    );
  });

  test("un estilo contenido dentro de otro no rompe el que lo envuelve", () => {
    const modelo = createModel("Hola mundo", [
      r(0, 10, "bold"),
      r(5, 7, "italic"),
    ]);
    assert.equal(
      render(modelo),
      "<strong>Hola </strong>" +
        "<strong><em>mu</em></strong>" +
        "<strong>ndo</strong>",
    );
  });

  test("dos rangos del mismo estilo con un hueco salen como dos etiquetas", () => {
    const modelo = createModel("uno dos tres", [
      r(0, 3, "bold"),
      r(8, 12, "bold"),
    ]);
    assert.equal(
      render(modelo),
      "<strong>uno</strong> dos <strong>tres</strong>",
    );
  });
});

describe("escapado", () => {
  test("escapa los tres caracteres peligrosos", () => {
    const modelo = createModel("a < b & c > d");
    assert.equal(render(modelo), "a &lt; b &amp; c &gt; d");
  });

  test("una etiqueta tecleada sale como texto visible", () => {
    const modelo = createModel("<script>alert(1)</script>");
    assert.equal(
      render(modelo),
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  test("el ampersand se escapa una sola vez", () => {
    assert.equal(render(createModel("&amp;")), "&amp;amp;");
  });

  test("el escapado convive con los estilos", () => {
    const modelo = createModel("a<b", [r(0, 3, "bold")]);
    assert.equal(render(modelo), "<strong>a&lt;b</strong>");
  });

  test("las comillas no se tocan: la salida nunca va en un atributo", () => {
    assert.equal(render(createModel('dijo "hola"')), 'dijo "hola"');
  });
});

describe("saltos de línea", () => {
  test("van literales, sin <br>", () => {
    assert.equal(render(createModel("uno\ndos")), "uno\ndos");
  });

  test("un rango puede cruzar un salto de línea", () => {
    const modelo = createModel("uno\ndos", [r(0, 7, "bold")]);
    assert.equal(render(modelo), "<strong>uno\ndos</strong>");
  });

  test("una línea vacía se conserva", () => {
    assert.equal(render(createModel("uno\n\ndos")), "uno\n\ndos");
  });

  test("un texto que es solo un salto de línea no desaparece", () => {
    assert.equal(render(createModel("\n")), "\n<br>");
  });

  test("un texto que termina en salto lleva el <br> de relleno", () => {
    assert.equal(render(createModel("uno\n")), "uno\n<br>");
  });

  test("el relleno va fuera de las etiquetas de estilo", () => {
    const modelo = createModel("uno\n", [r(0, 4, "bold")]);
    assert.equal(render(modelo), "<strong>uno\n</strong><br>");
  });

  test("un salto en medio no lleva relleno: solo el del final", () => {
    assert.equal(render(createModel("uno\ndos\n")), "uno\ndos\n<br>");
  });

  test("un texto que no termina en salto no lleva relleno", () => {
    assert.equal(render(createModel("uno\ndos")), "uno\ndos");
  });
});

describe("pureza y robustez", () => {
  test("no muta el modelo", () => {
    const modelo = createModel("Hola mundo", [r(0, 4, "bold")]);
    const copia = structuredClone(modelo);
    render(modelo);
    assert.deepEqual(modelo, copia);
  });

  test("el mismo modelo produce siempre la misma cadena", () => {
    const modelo = createModel("Hola mundo", [
      r(0, 6, "italic"),
      r(3, 10, "bold"),
    ]);
    assert.equal(render(modelo), render(modelo));
  });

  test("un modelo sin la propiedad ranges no rompe", () => {
    assert.equal(render({ text: "Hola" }), "Hola");
  });

  test("el texto renderizado, sin etiquetas, es el texto del modelo", () => {
    const modelo = createModel("Hola mundo cruel", [
      r(0, 4, "bold"),
      r(5, 10, "italic"),
      r(8, 16, "underline"),
    ]);
    const plano = render(modelo).replace(/<[^>]+>/g, "");
    assert.equal(plano, modelo.text);
  });
});
