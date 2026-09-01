/**
 * Tests del modelo del editor (S04 tarea 1).
 *
 * El modelo es el cimiento del sprint: `render.js`, `commands.js` e
 * `history.js` dan por hecho que un modelo siempre está normalizado. Por eso
 * aquí no basta con comprobar el resultado de cada operación; cada test pasa
 * además por `assertInvariants`, que verifica las tres reglas que ninguna
 * operación puede romper:
 *
 *   1. `start < end` en todos los rangos, y `end <= text.length`.
 *   2. Dos rangos del mismo estilo nunca se solapan ni se tocan.
 *   3. La lista viene ordenada por `start`, y a igualdad por orden de estilo.
 *
 * Si una operación futura rompe cualquiera de las tres, falla aquí y no tres
 * archivos más allá, cuando el render pinte etiquetas cruzadas.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  STYLES,
  applyStyle,
  clearStyles,
  createModel,
  deleteRange,
  getPlainText,
  hasStyle,
  insertText,
  normalize,
  removeStyle,
  stylesAt,
  toggleStyle,
} from "../public/static/js/editor/model.js";

/**
 * Comprueba los invariantes del modelo. Se llama tras cada operación.
 */
function assertInvariants(model, mensaje = "") {
  const contexto = mensaje ? ` (${mensaje})` : "";

  for (const range of model.ranges) {
    assert.ok(
      Number.isInteger(range.start) && Number.isInteger(range.end),
      `offsets no enteros${contexto}: ${JSON.stringify(range)}`,
    );
    assert.ok(
      range.start < range.end,
      `rango vacío o invertido${contexto}: ${JSON.stringify(range)}`,
    );
    assert.ok(
      range.end <= model.text.length,
      `rango fuera del texto${contexto}: ${JSON.stringify(range)}`,
    );
    assert.ok(
      STYLES.includes(range.style),
      `estilo desconocido${contexto}: ${JSON.stringify(range)}`,
    );
  }

  for (const style of STYLES) {
    const sameStyle = model.ranges.filter((range) => range.style === style);
    for (let i = 1; i < sameStyle.length; i += 1) {
      assert.ok(
        sameStyle[i - 1].end < sameStyle[i].start,
        `rangos "${style}" que se tocan o solapan${contexto}: ` +
          `${JSON.stringify(sameStyle[i - 1])} y ${JSON.stringify(sameStyle[i])}`,
      );
    }
  }

  const orden = model.ranges.map(
    (range) => [range.start, STYLES.indexOf(range.style), range.end].join(":"),
  );
  const esperado = [...model.ranges]
    .sort(
      (a, b) =>
        a.start - b.start ||
        STYLES.indexOf(a.style) - STYLES.indexOf(b.style) ||
        a.end - b.end,
    )
    .map(
      (range) => [range.start, STYLES.indexOf(range.style), range.end].join(":"),
    );
  assert.deepEqual(orden, esperado, `rangos desordenados${contexto}`);
}

/** Atajo para escribir rangos sin ruido en los tests. */
const r = (start, end, style) => ({ start, end, style });

describe("createModel y normalize", () => {
  test("el modelo vacío es texto vacío y cero rangos", () => {
    const modelo = createModel();
    assert.deepEqual(modelo, { text: "", ranges: [] });
    assertInvariants(modelo);
  });

  test("un texto sin rangos sobrevive intacto", () => {
    const modelo = createModel("Hola mundo");
    assert.equal(getPlainText(modelo), "Hola mundo");
    assert.deepEqual(modelo.ranges, []);
  });

  test("fusiona dos rangos del mismo estilo que se tocan", () => {
    const modelo = createModel("Hola mundo", [
      r(4, 8, "bold"),
      r(0, 4, "bold"),
    ]);
    assert.deepEqual(modelo.ranges, [r(0, 8, "bold")]);
    assertInvariants(modelo);
  });

  test("fusiona dos rangos del mismo estilo que se solapan", () => {
    const modelo = createModel("Hola mundo", [
      r(0, 6, "bold"),
      r(4, 10, "bold"),
    ]);
    assert.deepEqual(modelo.ranges, [r(0, 10, "bold")]);
    assertInvariants(modelo);
  });

  test("absorbe un rango contenido dentro de otro", () => {
    const modelo = createModel("Hola mundo", [
      r(0, 10, "bold"),
      r(3, 5, "bold"),
    ]);
    assert.deepEqual(modelo.ranges, [r(0, 10, "bold")]);
  });

  test("no fusiona rangos de estilos distintos aunque se toquen", () => {
    const modelo = createModel("Hola mundo", [
      r(0, 4, "bold"),
      r(4, 8, "italic"),
    ]);
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold"), r(4, 8, "italic")]);
    assertInvariants(modelo);
  });

  test("descarta los rangos vacíos", () => {
    const modelo = createModel("Hola", [r(2, 2, "bold"), r(0, 2, "italic")]);
    assert.deepEqual(modelo.ranges, [r(0, 2, "italic")]);
  });

  test("descarta los rangos invertidos", () => {
    const modelo = createModel("Hola", [r(3, 1, "bold")]);
    assert.deepEqual(modelo.ranges, []);
  });

  test("recorta los rangos que se salen del texto", () => {
    const modelo = createModel("Hola", [r(2, 99, "bold")]);
    assert.deepEqual(modelo.ranges, [r(2, 4, "bold")]);
    assertInvariants(modelo);
  });

  test("descarta los estilos desconocidos", () => {
    const modelo = createModel("Hola", [r(0, 4, "blink")]);
    assert.deepEqual(modelo.ranges, []);
  });

  test("ordena por start y, a igualdad, por el orden de STYLES", () => {
    const modelo = createModel("Hola mundo", [
      r(5, 10, "italic"),
      r(0, 4, "italic"),
      r(0, 4, "bold"),
      r(0, 4, "underline"),
    ]);
    assert.deepEqual(modelo.ranges, [
      r(0, 4, "bold"),
      r(0, 4, "italic"),
      r(0, 4, "underline"),
      r(5, 10, "italic"),
    ]);
    assertInvariants(modelo);
  });

  test("no muta el modelo que recibe", () => {
    const original = { text: "Hola", ranges: [r(0, 2, "bold")] };
    const copia = structuredClone(original);
    normalize(original);
    assert.deepEqual(original, copia);
  });

  test("es idempotente", () => {
    const una = createModel("Hola mundo", [r(0, 6, "bold"), r(4, 10, "bold")]);
    assert.deepEqual(normalize(una), una);
  });
});

describe("applyStyle", () => {
  test("aplica un estilo a un tramo", () => {
    const modelo = applyStyle(createModel("Hola mundo"), 0, 4, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold")]);
    assertInvariants(modelo);
  });

  test("acepta los offsets al revés", () => {
    const modelo = applyStyle(createModel("Hola mundo"), 4, 0, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold")]);
  });

  test("con la selección colapsada no cambia nada", () => {
    const antes = createModel("Hola mundo", [r(0, 4, "bold")]);
    assert.deepEqual(applyStyle(antes, 2, 2, "italic"), antes);
  });

  test("dos tramos contiguos acaban siendo uno", () => {
    let modelo = applyStyle(createModel("Hola mundo"), 0, 5, "bold");
    modelo = applyStyle(modelo, 5, 10, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 10, "bold")]);
    assertInvariants(modelo);
  });

  test("dos estilos sobre el mismo tramo conviven como rangos distintos", () => {
    let modelo = applyStyle(createModel("Hola mundo"), 0, 4, "bold");
    modelo = applyStyle(modelo, 0, 4, "italic");
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold"), r(0, 4, "italic")]);
    assertInvariants(modelo);
  });

  test("aplicar dos veces el mismo estilo no duplica el rango", () => {
    let modelo = applyStyle(createModel("Hola mundo"), 0, 4, "bold");
    modelo = applyStyle(modelo, 0, 4, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold")]);
  });

  test("un estilo desconocido no entra en el modelo", () => {
    const modelo = applyStyle(createModel("Hola"), 0, 4, "blink");
    assert.deepEqual(modelo.ranges, []);
  });

  test("no muta el modelo de entrada", () => {
    const antes = createModel("Hola mundo", [r(0, 4, "bold")]);
    const copia = structuredClone(antes);
    applyStyle(antes, 5, 10, "italic");
    assert.deepEqual(antes, copia);
  });
});

describe("removeStyle", () => {
  test("quitar el centro parte el rango en dos", () => {
    const antes = createModel("Hola mundo", [r(0, 10, "bold")]);
    const modelo = removeStyle(antes, 4, 6, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold"), r(6, 10, "bold")]);
    assertInvariants(modelo);
  });

  test("quitar el principio recorta por la izquierda", () => {
    const antes = createModel("Hola mundo", [r(0, 10, "bold")]);
    assert.deepEqual(removeStyle(antes, 0, 4, "bold").ranges, [
      r(4, 10, "bold"),
    ]);
  });

  test("quitar el final recorta por la derecha", () => {
    const antes = createModel("Hola mundo", [r(0, 10, "bold")]);
    assert.deepEqual(removeStyle(antes, 6, 10, "bold").ranges, [
      r(0, 6, "bold"),
    ]);
  });

  test("quitarlo entero deja el modelo sin rangos", () => {
    const antes = createModel("Hola mundo", [r(0, 10, "bold")]);
    assert.deepEqual(removeStyle(antes, 0, 10, "bold").ranges, []);
  });

  test("un tramo más ancho que el rango también lo elimina", () => {
    const antes = createModel("Hola mundo", [r(4, 6, "bold")]);
    assert.deepEqual(removeStyle(antes, 0, 10, "bold").ranges, []);
  });

  test("no toca los demás estilos", () => {
    const antes = createModel("Hola mundo", [
      r(0, 10, "bold"),
      r(0, 10, "italic"),
    ]);
    const modelo = removeStyle(antes, 4, 6, "bold");
    assert.deepEqual(modelo.ranges, [
      r(0, 4, "bold"),
      r(0, 10, "italic"),
      r(6, 10, "bold"),
    ]);
    assertInvariants(modelo);
  });

  test("quitar donde no hay nada no cambia el modelo", () => {
    const antes = createModel("Hola mundo", [r(0, 4, "bold")]);
    assert.deepEqual(removeStyle(antes, 5, 10, "bold"), antes);
  });

  test("con la selección colapsada no cambia nada", () => {
    const antes = createModel("Hola mundo", [r(0, 10, "bold")]);
    assert.deepEqual(removeStyle(antes, 5, 5, "bold"), antes);
  });
});

describe("hasStyle", () => {
  const modelo = createModel("Hola mundo", [r(0, 4, "bold")]);

  test('devuelve "all" sobre el rango exacto', () => {
    assert.equal(hasStyle(modelo, 0, 4, "bold"), "all");
  });

  test('devuelve "all" sobre un tramo contenido', () => {
    assert.equal(hasStyle(modelo, 1, 3, "bold"), "all");
  });

  test('devuelve "none" fuera del rango', () => {
    assert.equal(hasStyle(modelo, 5, 10, "bold"), "none");
  });

  test('devuelve "partial" a caballo de la frontera', () => {
    assert.equal(hasStyle(modelo, 2, 8, "bold"), "partial");
  });

  test('devuelve "none" para un estilo que no está en el modelo', () => {
    assert.equal(hasStyle(modelo, 0, 4, "italic"), "none");
  });

  test('dos rangos con un hueco en medio dan "partial"', () => {
    const conHueco = createModel("Hola mundo", [
      r(0, 3, "bold"),
      r(6, 10, "bold"),
    ]);
    assert.equal(hasStyle(conHueco, 0, 10, "bold"), "partial");
  });

  test("acepta los offsets al revés", () => {
    assert.equal(hasStyle(modelo, 4, 0, "bold"), "all");
  });

  describe("con la selección colapsada mira el carácter de la izquierda", () => {
    test("justo detrás del rango está activo", () => {
      assert.equal(hasStyle(modelo, 4, 4, "bold"), "all");
    });

    test("dentro del rango está activo", () => {
      assert.equal(hasStyle(modelo, 2, 2, "bold"), "all");
    });

    test("justo delante del rango no lo está", () => {
      assert.equal(hasStyle(modelo, 0, 0, "bold"), "none");
    });

    test("un carácter más allá del rango no lo está", () => {
      assert.equal(hasStyle(modelo, 5, 5, "bold"), "none");
    });
  });
});

describe("toggleStyle", () => {
  test('desde "none" lo aplica', () => {
    const modelo = toggleStyle(createModel("Hola mundo"), 0, 4, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 4, "bold")]);
  });

  test('desde "all" lo quita', () => {
    const antes = createModel("Hola mundo", [r(0, 4, "bold")]);
    assert.deepEqual(toggleStyle(antes, 0, 4, "bold").ranges, []);
  });

  test('desde "partial" completa el tramo en vez de invertirlo', () => {
    const antes = createModel("Hola mundo", [r(0, 4, "bold")]);
    const modelo = toggleStyle(antes, 2, 8, "bold");
    assert.deepEqual(modelo.ranges, [r(0, 8, "bold")]);
    assertInvariants(modelo);
  });

  test("alternar dos veces devuelve el modelo de partida", () => {
    const antes = createModel("Hola mundo", [r(5, 10, "italic")]);
    const ida = toggleStyle(antes, 0, 4, "bold");
    assert.deepEqual(toggleStyle(ida, 0, 4, "bold"), antes);
  });

  test("con la selección colapsada no cambia nada", () => {
    const antes = createModel("Hola mundo", [r(0, 4, "bold")]);
    assert.deepEqual(toggleStyle(antes, 2, 2, "bold"), antes);
  });
});

describe("insertText", () => {
  const antes = createModel("Hola mundo", [r(5, 10, "bold")]);

  test("inserta el texto en la posición pedida", () => {
    const modelo = insertText(antes, 5, "ancho ");
    assert.equal(getPlainText(modelo), "Hola ancho mundo");
  });

  test("desplaza los rangos que quedan por detrás", () => {
    const modelo = insertText(antes, 0, "¡");
    assert.deepEqual(modelo.ranges, [r(6, 11, "bold")]);
    assertInvariants(modelo);
  });

  test("insertar dentro de un rango lo hace crecer", () => {
    const modelo = insertText(antes, 7, "XX");
    assert.deepEqual(modelo.ranges, [r(5, 12, "bold")]);
    assert.equal(getPlainText(modelo), "Hola muXXndo");
  });

  test("insertar justo en el borde izquierdo no extiende el estilo", () => {
    const modelo = insertText(antes, 5, "XX");
    assert.deepEqual(modelo.ranges, [r(7, 12, "bold")]);
  });

  test("insertar justo en el borde derecho no extiende el estilo", () => {
    const modelo = insertText(antes, 10, "XX");
    assert.deepEqual(modelo.ranges, [r(5, 10, "bold")]);
  });

  test("insertar detrás del rango no lo toca", () => {
    const conCola = createModel("Hola mundo", [r(0, 4, "bold")]);
    assert.deepEqual(insertText(conCola, 10, "!").ranges, [r(0, 4, "bold")]);
  });

  test("insertar cadena vacía no cambia nada", () => {
    assert.deepEqual(insertText(antes, 3, ""), antes);
  });

  test("una posición fuera de rango se recorta al final del texto", () => {
    const modelo = insertText(antes, 999, "!");
    assert.equal(getPlainText(modelo), "Hola mundo!");
    assertInvariants(modelo);
  });

  test("sobre el modelo vacío deja solo el texto insertado", () => {
    const modelo = insertText(createModel(), 0, "Hola");
    assert.deepEqual(modelo, { text: "Hola", ranges: [] });
  });

  test("un salto de línea es un carácter más del texto", () => {
    const modelo = insertText(createModel("AB", [r(0, 2, "bold")]), 1, "\n");
    assert.equal(getPlainText(modelo), "A\nB");
    assert.deepEqual(modelo.ranges, [r(0, 3, "bold")]);
  });
});

describe("deleteRange", () => {
  const antes = createModel("Hola mundo", [r(5, 10, "bold")]);

  test("borra el tramo del texto", () => {
    const modelo = deleteRange(antes, 0, 5);
    assert.equal(getPlainText(modelo), "mundo");
    assert.deepEqual(modelo.ranges, [r(0, 5, "bold")]);
    assertInvariants(modelo);
  });

  test("borrar dentro de un rango lo encoge", () => {
    const modelo = deleteRange(antes, 6, 8);
    assert.equal(getPlainText(modelo), "Hola mdo");
    assert.deepEqual(modelo.ranges, [r(5, 8, "bold")]);
  });

  test("borrar el rango entero lo elimina", () => {
    const modelo = deleteRange(antes, 5, 10);
    assert.equal(getPlainText(modelo), "Hola ");
    assert.deepEqual(modelo.ranges, []);
  });

  test("borrar a caballo del borde izquierdo recorta y desplaza", () => {
    const modelo = deleteRange(antes, 3, 7);
    assert.equal(getPlainText(modelo), "Holndo");
    assert.deepEqual(modelo.ranges, [r(3, 6, "bold")]);
    assertInvariants(modelo);
  });

  test("borrar a caballo del borde derecho recorta", () => {
    const modelo = deleteRange(antes, 8, 10);
    assert.equal(getPlainText(modelo), "Hola mun");
    assert.deepEqual(modelo.ranges, [r(5, 8, "bold")]);
  });

  test("borrar más de lo que abarca el rango lo elimina", () => {
    const modelo = deleteRange(antes, 4, 10);
    assert.equal(getPlainText(modelo), "Hola");
    assert.deepEqual(modelo.ranges, []);
  });

  test("borrarlo todo deja el modelo vacío", () => {
    const modelo = deleteRange(antes, 0, 10);
    assert.deepEqual(modelo, { text: "", ranges: [] });
  });

  test("acepta los offsets al revés", () => {
    assert.deepEqual(deleteRange(antes, 10, 5), deleteRange(antes, 5, 10));
  });

  test("con el tramo colapsado no cambia nada", () => {
    assert.deepEqual(deleteRange(antes, 7, 7), antes);
  });

  test("borrar entre dos rangos del mismo estilo los fusiona", () => {
    const partido = createModel("Hola mundo", [
      r(0, 4, "bold"),
      r(6, 10, "bold"),
    ]);
    const modelo = deleteRange(partido, 4, 6);
    assert.equal(getPlainText(modelo), "Holaundo");
    assert.deepEqual(modelo.ranges, [r(0, 8, "bold")]);
    assertInvariants(modelo);
  });
});

describe("clearStyles", () => {
  const antes = createModel("Hola mundo", [
    r(0, 10, "bold"),
    r(0, 4, "italic"),
    r(6, 10, "underline"),
  ]);

  test("quita todos los estilos del tramo y deja el texto igual", () => {
    const modelo = clearStyles(antes, 0, 10);
    assert.deepEqual(modelo.ranges, []);
    assert.equal(getPlainText(modelo), "Hola mundo");
  });

  test("respeta lo que queda fuera del tramo", () => {
    const modelo = clearStyles(antes, 0, 5);
    assert.deepEqual(modelo.ranges, [
      r(5, 10, "bold"),
      r(6, 10, "underline"),
    ]);
    assertInvariants(modelo);
  });

  test("limpiar el centro parte los rangos que lo cruzan", () => {
    const modelo = clearStyles(antes, 2, 8);
    assert.deepEqual(modelo.ranges, [
      r(0, 2, "bold"),
      r(0, 2, "italic"),
      r(8, 10, "bold"),
      r(8, 10, "underline"),
    ]);
    assertInvariants(modelo);
  });

  test("con el tramo colapsado no cambia nada", () => {
    assert.deepEqual(clearStyles(antes, 4, 4), antes);
  });

  test("sobre un modelo sin estilos no hace nada", () => {
    const plano = createModel("Hola mundo");
    assert.deepEqual(clearStyles(plano, 0, 10), plano);
  });
});

describe("stylesAt", () => {
  const modelo = createModel("Hola mundo", [
    r(0, 4, "bold"),
    r(0, 4, "italic"),
    r(6, 10, "underline"),
  ]);

  test("devuelve los estilos que cubren el tramo entero", () => {
    assert.deepEqual(stylesAt(modelo, 0, 4), ["bold", "italic"]);
  });

  test("no devuelve los que solo lo cubren en parte", () => {
    assert.deepEqual(stylesAt(modelo, 2, 8), []);
  });

  test("los devuelve en el orden de STYLES", () => {
    const todos = createModel("AB", [
      r(0, 2, "strikethrough"),
      r(0, 2, "underline"),
      r(0, 2, "italic"),
      r(0, 2, "bold"),
    ]);
    assert.deepEqual(stylesAt(todos, 0, 2), STYLES);
  });

  test("con el cursor colapsado mira el carácter de la izquierda", () => {
    assert.deepEqual(stylesAt(modelo, 4, 4), ["bold", "italic"]);
    assert.deepEqual(stylesAt(modelo, 5, 5), []);
  });
});

describe("el modelo vacío aguanta todas las operaciones", () => {
  const vacio = createModel();

  for (const [nombre, operacion] of [
    ["applyStyle", (m) => applyStyle(m, 0, 0, "bold")],
    ["removeStyle", (m) => removeStyle(m, 0, 0, "bold")],
    ["toggleStyle", (m) => toggleStyle(m, 0, 0, "bold")],
    ["deleteRange", (m) => deleteRange(m, 0, 0)],
    ["clearStyles", (m) => clearStyles(m, 0, 0)],
    ["insertText vacío", (m) => insertText(m, 0, "")],
  ]) {
    test(`${nombre} lo deja intacto`, () => {
      const modelo = operacion(vacio);
      assert.deepEqual(modelo, { text: "", ranges: [] });
      assertInvariants(modelo, nombre);
    });
  }

  test("hasStyle sobre el modelo vacío no falla", () => {
    assert.equal(hasStyle(vacio, 0, 0, "bold"), "none");
  });
});

describe("ADR-003: el texto del modelo nunca lleva caracteres matemáticos", () => {
  test("ninguna operación introduce nada del bloque U+1D400–U+1D7FF", () => {
    let modelo = createModel("Hola mundo");
    modelo = applyStyle(modelo, 0, 4, "bold");
    modelo = insertText(modelo, 4, " a todo el ");
    modelo = toggleStyle(modelo, 0, 8, "italic");
    modelo = deleteRange(modelo, 2, 5);

    for (const caracter of modelo.text) {
      const punto = caracter.codePointAt(0);
      assert.ok(
        punto < 0x1d400 || punto > 0x1d7ff,
        `carácter matemático en el modelo: U+${punto.toString(16)}`,
      );
    }
  });
});
