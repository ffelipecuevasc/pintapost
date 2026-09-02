/**
 * Tests de la segmentación compartida (S05, tarea 1).
 *
 * `segments` es ahora la única partición del texto que existe en el proyecto:
 * la usan `render` para pintar y `serialize` para copiar. Un fallo aquí sale
 * por los dos sitios a la vez, y la clase de fallo que más importa es la que
 * los haría **divergir** —un tramo que se corta en un sitio y no en el otro—,
 * porque el usuario acabaría copiando algo distinto de lo que ve.
 *
 * Hasta el S05 esta lógica se probaba de rebote, a través de la salida HTML de
 * `render.test.js`. Esos tests siguen ahí y siguen siendo válidos: comprueban
 * el marcado. Los de este archivo comprueban las fronteras, que es otra cosa, y
 * lo hacen sobre la función directamente en vez de deducirlas de una cadena de
 * etiquetas.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { segments } from "../public/static/js/editor/segments.js";

const r = (start, end, style) => ({ start, end, style });
const p = (start, end) => ({ start, end });

/** Los tramos en forma compacta, para poder compararlos de un vistazo. */
const shape = (list) =>
  list.map((s) => [s.start, s.end, s.styles.join("+"), s.protected]);

describe("particiones básicas", () => {
  test("un texto vacío no produce tramos", () => {
    assert.deepEqual(segments(0, []), []);
  });

  test("una longitud negativa o inválida tampoco", () => {
    assert.deepEqual(segments(-3, []), []);
    assert.deepEqual(segments(Number.NaN, []), []);
  });

  test("sin rangos hay un solo tramo que cubre todo el texto", () => {
    assert.deepEqual(shape(segments(10, [])), [[0, 10, "", false]]);
  });

  test("un rango que cubre todo el texto no añade fronteras", () => {
    assert.deepEqual(shape(segments(4, [r(0, 4, "bold")])), [
      [0, 4, "bold", false],
    ]);
  });

  test("un rango en medio parte el texto en tres", () => {
    assert.deepEqual(shape(segments(10, [r(5, 8, "bold")])), [
      [0, 5, "", false],
      [5, 8, "bold", false],
      [8, 10, "", false],
    ]);
  });

  test("los tramos son contiguos, sin huecos ni solapes", () => {
    const tramos = segments(20, [r(3, 9, "bold"), r(7, 15, "italic")]);

    assert.equal(tramos[0].start, 0);
    assert.equal(tramos.at(-1).end, 20);
    for (let i = 1; i < tramos.length; i += 1) {
      assert.equal(tramos[i].start, tramos[i - 1].end);
    }
  });
});

describe("estilos por tramo", () => {
  test("el solapamiento parcial produce el tramo de la intersección", () => {
    // Negrita 0–10 y cursiva 5–15: el ejemplo de la cabecera de render.js.
    assert.deepEqual(shape(segments(15, [r(0, 10, "bold"), r(5, 15, "italic")])), [
      [0, 5, "bold", false],
      [5, 10, "bold+italic", false],
      [10, 15, "italic", false],
    ]);
  });

  test("los estilos salen en el orden de STYLES, no en el de los rangos", () => {
    const tramos = segments(4, [
      r(0, 4, "strikethrough"),
      r(0, 4, "italic"),
      r(0, 4, "underline"),
      r(0, 4, "bold"),
    ]);
    assert.deepEqual(tramos[0].styles, [
      "bold",
      "italic",
      "underline",
      "strikethrough",
    ]);
  });

  test("un estilo contenido dentro de otro no rompe el que lo envuelve", () => {
    assert.deepEqual(shape(segments(10, [r(0, 10, "bold"), r(5, 7, "italic")])), [
      [0, 5, "bold", false],
      [5, 7, "bold+italic", false],
      [7, 10, "bold", false],
    ]);
  });

  test("dos rangos del mismo estilo con un hueco dejan el hueco sin estilo", () => {
    assert.deepEqual(shape(segments(12, [r(0, 3, "bold"), r(8, 12, "bold")])), [
      [0, 3, "bold", false],
      [3, 8, "", false],
      [8, 12, "bold", false],
    ]);
  });

  test("un rango vacío se descarta y no introduce una frontera falsa", () => {
    assert.deepEqual(shape(segments(6, [r(3, 3, "bold")])), [[0, 6, "", false]]);
  });

  test("un rango que se sale del texto no desborda la partición", () => {
    assert.deepEqual(shape(segments(5, [r(2, 40, "bold")])), [
      [0, 2, "", false],
      [2, 5, "bold", false],
    ]);
  });
});

describe("tramos protegidos", () => {
  test("un tramo protegido se corta como cualquier otra frontera", () => {
    // "Hola #tag ya": el hashtag ocupa 5–9.
    assert.deepEqual(shape(segments(12, [], [p(5, 9)])), [
      [0, 5, "", false],
      [5, 9, "", true],
      [9, 12, "", false],
    ]);
  });

  test("un tramo protegido dentro de uno en negrita conserva el estilo declarado", () => {
    // Es la clave del reparto: `segments` no anula nada. Declara que el tramo
    // está en negrita Y protegido, y cada consumidor decide. `serialize` lo
    // emite literal; `render` lo pinta con su pista visual.
    const tramos = segments(12, [r(0, 12, "bold")], [p(5, 9)]);

    assert.deepEqual(shape(tramos), [
      [0, 5, "bold", false],
      [5, 9, "bold", true],
      [9, 12, "bold", false],
    ]);
  });

  test("dos tramos protegidos seguidos se cortan por separado", () => {
    assert.deepEqual(shape(segments(14, [], [p(0, 4), p(5, 10)])), [
      [0, 4, "", true],
      [4, 5, "", false],
      [5, 10, "", true],
      [10, 14, "", false],
    ]);
  });

  test("un tramo protegido que cubre todo el texto deja un único tramo", () => {
    assert.deepEqual(shape(segments(7, [], [p(0, 7)])), [[0, 7, "", true]]);
  });

  test("las fronteras del estilo y las de la protección se combinan", () => {
    // Negrita 0–8 y protegido 6–12: cuatro fronteras, tres tramos.
    assert.deepEqual(shape(segments(12, [r(0, 8, "bold")], [p(6, 12)])), [
      [0, 6, "bold", false],
      [6, 8, "bold", true],
      [8, 12, "", true],
    ]);
  });

  test("sin tercer argumento nada sale protegido", () => {
    const tramos = segments(6, [r(0, 6, "bold")]);
    assert.equal(tramos.every((s) => s.protected === false), true);
  });
});

describe("pureza", () => {
  test("no muta los rangos que recibe", () => {
    const ranges = [r(0, 4, "bold")];
    const protectedRanges = [p(1, 2)];
    const copia = structuredClone({ ranges, protectedRanges });

    segments(10, ranges, protectedRanges);

    assert.deepEqual({ ranges, protectedRanges }, copia);
  });

  test("la misma entrada produce siempre la misma partición", () => {
    const ranges = [r(0, 6, "italic"), r(3, 10, "bold")];
    assert.deepEqual(segments(10, ranges), segments(10, ranges));
  });
});
