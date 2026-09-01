/**
 * Round-trip DOM ↔ modelo sobre un DOM real (S04, X-34).
 *
 * `readModelFromDom(render(m))` debe devolver exactamente `m`. Es **el
 * invariante que sostiene el editor**, porque es lo que hace compatibles las
 * dos direcciones del flujo del S04: al teclear se lee del DOM sin repintar, y
 * al pulsar negrita se repinta desde el modelo. Si repintar y volver a leer no
 * diera el mismo modelo, alternar entre las dos cosas iría corrompiendo el
 * texto poco a poco y en silencio.
 *
 * Estos tests corren sobre `linkedom`, no sobre un DOM de juguete escrito para
 * la ocasión (ADR-020). La diferencia importa: un DOM propio comprueba nuestras
 * suposiciones sobre el DOM, y son justamente esas suposiciones —cómo se anida
 * lo que escribe el navegador, qué es un `<br>` de relleno, dónde empieza un
 * bloque— las que `selection.js` tiene que acertar.
 *
 * Dos direcciones:
 *
 *   1. Modelo → HTML → modelo, con diez modelos representativos.
 *   2. Lo que el navegador escribe por su cuenta → modelo, con las siete
 *      formas que inserta sin que se lo pidamos.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseHTML } from "linkedom";

import { createModel } from "../public/static/js/editor/model.js";
import { render } from "../public/static/js/editor/render.js";
import { readModelFromDom } from "../public/static/js/editor/selection.js";

const { document } = parseHTML("<!doctype html><html><body></body></html>");

const r = (start, end, style) => ({ start, end, style });

/** Un `contenteditable` con el marcado dado dentro. */
function editorWith(html) {
  const root = document.createElement("div");
  root.setAttribute("contenteditable", "true");
  root.innerHTML = html;
  return root;
}

/** Modelo → HTML → DOM → modelo. */
function roundTrip(model) {
  return readModelFromDom(editorWith(render(model)));
}

/** El modelo que se lee de un árbol escrito por el navegador. */
function readFrom(html) {
  return readModelFromDom(editorWith(html));
}

describe("round-trip: los diez modelos", () => {
  test("1. el modelo vacío", () => {
    const modelo = createModel();
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("2. texto plano con acentos y eñes", () => {
    const modelo = createModel("Una canción del ñandú, ¿qué tal?");
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("3. estilos anidados", () => {
    const modelo = createModel("Hola mundo", [
      r(0, 10, "bold"),
      r(0, 10, "italic"),
    ]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("4. solapamiento parcial", () => {
    // Negrita 0–10 y cursiva 5–15: el caso que obliga a partir por fronteras,
    // porque el HTML no admite `<strong>uno <em>dos</strong> tres</em>`.
    const modelo = createModel("0123456789abcde", [
      r(0, 10, "bold"),
      r(5, 15, "italic"),
    ]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("5. los cuatro estilos a la vez", () => {
    const modelo = createModel("Todo junto", [
      r(0, 10, "bold"),
      r(0, 10, "italic"),
      r(0, 10, "underline"),
      r(0, 10, "strikethrough"),
    ]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("6. saltos de línea, incluida una línea en blanco", () => {
    const modelo = createModel("uno\ndos\n\ntres", [r(4, 7, "bold")]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("7. escapado de < > &", () => {
    const modelo = createModel("a < b & c > d <script>alert(1)</script>", [
      r(0, 13, "bold"),
    ]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("8. emoji, con un estilo que cubre el par subrogado", () => {
    // Los offsets van en unidades UTF-16 (ADR-019): el 🎉 ocupa dos.
    const modelo = createModel("Genial 🎉 hoy", [r(7, 9, "bold")]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("9. viñetas, que son prefijos de texto y no estructura", () => {
    const modelo = createModel("• uno\n• dos\n• tres", [
      r(2, 5, "bold"),
      r(14, 18, "italic"),
    ]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });

  test("10. texto terminado en salto de línea", () => {
    // El caso del `<br>` de relleno: `render` lo añade para dar altura a la
    // línea vacía final, y leerlo como salto duplicaría el `\n`.
    const modelo = createModel("uno\ndos\n", [r(0, 3, "bold")]);
    assert.deepEqual(roundTrip(modelo), modelo);
  });
});

describe("lectura: las siete formas que inserta el navegador", () => {
  test("1. <br> suelto: el editor vacío se lee como texto vacío", () => {
    // Al borrarlo todo, el navegador deja un `<br>` para que la línea tenga
    // altura. Leerlo como `\n` acumularía un salto fantasma en cada vaciado.
    assert.deepEqual(readFrom("<br>"), createModel());
  });

  test("2. <br> entre texto: es un salto real", () => {
    assert.deepEqual(readFrom("uno<br>dos"), createModel("uno\ndos"));
  });

  test("3. <div> hermanos: lo que escribe Chrome al pulsar Enter", () => {
    assert.deepEqual(
      readFrom("uno<div>dos</div><div>tres</div>"),
      createModel("uno\ndos\ntres"),
    );
  });

  test("4. <b> nativo se lee como negrita", () => {
    assert.deepEqual(
      readFrom("<b>negrita</b> normal"),
      createModel("negrita normal", [r(0, 7, "bold")]),
    );
  });

  test("5. <i> nativo se lee como cursiva", () => {
    assert.deepEqual(
      readFrom("<i>cursiva</i> normal"),
      createModel("cursiva normal", [r(0, 7, "italic")]),
    );
  });

  test("6. <span> con estilo en línea entra como texto plano", () => {
    // Lo que aparece al pegar desde otra aplicación. El estilo en línea se
    // ignora a propósito: el modelo solo reconoce las cuatro etiquetas
    // semánticas, así que un `font-weight` ajeno no se convierte en negrita.
    assert.deepEqual(
      readFrom('<span style="font-weight:700">pegado</span>'),
      createModel("pegado"),
    );
  });

  test("7. <div><br></div> final: un Enter al final del texto", () => {
    assert.deepEqual(readFrom("abc<div><br></div>"), createModel("abc\n"));
  });
});

describe("convergencia", () => {
  test("lo leído del navegador sobrevive a un repintado", () => {
    // La segunda mitad del invariante: lo que se lee de un árbol ajeno se
    // repinta y se vuelve a leer igual. Sin esto, la primera pulsación de
    // negrita después de un Enter movería el texto.
    const formas = [
      "<br>",
      "uno<br>dos",
      "uno<div>dos</div><div>tres</div>",
      "<b>negrita</b> normal",
      "<i>cursiva</i> normal",
      '<span style="font-weight:700">pegado</span>',
      "abc<div><br></div>",
    ];

    for (const forma of formas) {
      const modelo = readFrom(forma);
      assert.deepEqual(roundTrip(modelo), modelo, `no converge: ${forma}`);
    }
  });
});
