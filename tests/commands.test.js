/**
 * Tests de los comandos y del historial (S04 tareas 5, 6, 7 y 8).
 *
 * Aquí se concentra lo que el sprint señala como el punto donde es más fácil
 * equivocarse: al poner o quitar un prefijo de lista, los rangos de estilo de
 * esas líneas tienen que desplazarse exactamente tantas posiciones como ocupa
 * el prefijo. Un fallo ahí no se ve en el modelo, se ve en pantalla, con la
 * negrita corrida dos caracteres a la izquierda.
 *
 * El historial vive en `history.js`, pero se prueba en este archivo porque lo
 * único que se le pide es sostener un guion de comandos de principio a fin.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  createModel,
  getPlainText,
  hasStyle,
} from "../public/static/js/editor/model.js";
import {
  applyStyleSet,
  cleanPastedText,
  clearFormatting,
  dropText,
  insertPlainText,
  toggleBulletList,
  toggleNumberedList,
  toggleTextStyle,
} from "../public/static/js/editor/commands.js";
import {
  canRedo,
  canUndo,
  createHistory,
  record,
  redo,
  undo,
} from "../public/static/js/editor/history.js";
import { toStyled } from "../public/static/js/format/unicode.js";

const r = (start, end, style) => ({ start, end, style });
const sel = (from, to = from) => ({ from, to });

describe("toggleTextStyle", () => {
  const modelo = createModel("Hola mundo", [r(0, 4, "bold")]);

  test('desde "none" aplica el estilo', () => {
    const salida = toggleTextStyle(modelo, sel(5, 10), "bold");
    assert.equal(hasStyle(salida.model, 5, 10, "bold"), "all");
  });

  test('desde "all" lo quita', () => {
    const salida = toggleTextStyle(modelo, sel(0, 4), "bold");
    assert.equal(hasStyle(salida.model, 0, 4, "bold"), "none");
  });

  test('desde "partial" completa el tramo entero', () => {
    const salida = toggleTextStyle(modelo, sel(2, 8), "bold");
    assert.equal(hasStyle(salida.model, 0, 8, "bold"), "all");
  });

  test("no cambia la selección", () => {
    assert.deepEqual(toggleTextStyle(modelo, sel(2, 8), "bold").selection, {
      from: 2,
      to: 8,
    });
  });

  test("acepta la selección al revés y la devuelve ordenada", () => {
    const salida = toggleTextStyle(modelo, sel(8, 2), "italic");
    assert.deepEqual(salida.selection, { from: 2, to: 8 });
    assert.equal(hasStyle(salida.model, 2, 8, "italic"), "all");
  });

  test("no toca el texto", () => {
    assert.equal(
      getPlainText(toggleTextStyle(modelo, sel(0, 10), "underline").model),
      "Hola mundo",
    );
  });
});

describe("clearFormatting", () => {
  const modelo = createModel("Hola mundo", [
    r(0, 10, "bold"),
    r(0, 4, "italic"),
  ]);

  test("limpia solo la selección", () => {
    const salida = clearFormatting(modelo, sel(0, 5));
    assert.deepEqual(salida.model.ranges, [r(5, 10, "bold")]);
  });

  test("sin selección limpia todo el texto", () => {
    const salida = clearFormatting(modelo, sel(4));
    assert.deepEqual(salida.model.ranges, []);
  });

  test("devuelve el texto plano exacto", () => {
    const salida = clearFormatting(modelo, sel(0));
    assert.equal(getPlainText(salida.model), "Hola mundo");
  });

  test("sobre un texto ya limpio no cambia nada", () => {
    const plano = createModel("Hola mundo");
    assert.deepEqual(clearFormatting(plano, sel(0)).model, plano);
  });
});

describe("listas con viñetas", () => {
  test("añade el prefijo a todas las líneas de la selección", () => {
    const modelo = createModel("uno\ndos");
    const salida = toggleBulletList(modelo, sel(0, 7));
    assert.equal(getPlainText(salida.model), "• uno\n• dos");
  });

  test("los rangos de estilo se desplazan tanto como ocupa el prefijo", () => {
    const modelo = createModel("uno\ndos", [r(0, 3, "bold")]);
    const salida = toggleBulletList(modelo, sel(0, 7));
    // "uno" estaba en 0–3; con "• " delante pasa a 2–5.
    assert.deepEqual(salida.model.ranges, [r(2, 5, "bold")]);
    assert.equal(
      salida.model.text.slice(2, 5),
      "uno",
      "la negrita ya no cubre la misma palabra",
    );
  });

  test("el estilo de la segunda línea también se desplaza", () => {
    const modelo = createModel("uno\ndos", [r(4, 7, "italic")]);
    const salida = toggleBulletList(modelo, sel(0, 7));
    assert.equal(salida.model.text.slice(8, 11), "dos");
    assert.deepEqual(salida.model.ranges, [r(8, 11, "italic")]);
  });

  test("quitarlo devuelve el texto y los rangos de partida", () => {
    const modelo = createModel("uno\ndos", [r(0, 3, "bold"), r(4, 7, "italic")]);
    const puesta = toggleBulletList(modelo, sel(0, 7));
    const quitada = toggleBulletList(puesta.model, puesta.selection);
    assert.deepEqual(quitada.model, modelo);
    assert.deepEqual(quitada.selection, { from: 0, to: 7 });
  });

  test("con el cursor colapsado afecta solo a su línea", () => {
    const modelo = createModel("uno\ndos\ntres");
    const salida = toggleBulletList(modelo, sel(5));
    assert.equal(getPlainText(salida.model), "uno\n• dos\ntres");
  });

  test("si solo una línea lleva prefijo, se completan las demás", () => {
    const modelo = createModel("• uno\ndos");
    const salida = toggleBulletList(modelo, sel(0, 9));
    assert.equal(getPlainText(salida.model), "• uno\n• dos");
  });

  test("se salta las líneas vacías", () => {
    const modelo = createModel("uno\n\ndos");
    const salida = toggleBulletList(modelo, sel(0, 8));
    assert.equal(getPlainText(salida.model), "• uno\n\n• dos");
  });

  test("una línea vacía dentro de la selección no impide desactivar la lista", () => {
    const modelo = createModel("uno\n\ndos");
    const puesta = toggleBulletList(modelo, sel(0, 8));
    const quitada = toggleBulletList(puesta.model, puesta.selection);
    assert.equal(getPlainText(quitada.model), "uno\n\ndos");
  });

  test("una selección que acaba justo en el salto no arrastra la línea siguiente", () => {
    const modelo = createModel("uno\ndos");
    const salida = toggleBulletList(modelo, sel(0, 4));
    assert.equal(getPlainText(salida.model), "• uno\ndos");
  });

  test("sobre un texto vacío no hace nada", () => {
    const modelo = createModel();
    assert.deepEqual(toggleBulletList(modelo, sel(0)).model, modelo);
  });
});

describe("listas numeradas", () => {
  test("numera desde uno el bloque seleccionado", () => {
    const modelo = createModel("uno\ndos\ntres");
    const salida = toggleNumberedList(modelo, sel(0, 12));
    assert.equal(getPlainText(salida.model), "1. uno\n2. dos\n3. tres");
  });

  test("renumera desde uno aunque la selección empiece en la segunda línea", () => {
    const modelo = createModel("uno\ndos\ntres");
    const salida = toggleNumberedList(modelo, sel(4, 12));
    assert.equal(getPlainText(salida.model), "uno\n1. dos\n2. tres");
  });

  test("quitarla devuelve el texto de partida", () => {
    const modelo = createModel("uno\ndos\ntres");
    const puesta = toggleNumberedList(modelo, sel(0, 12));
    const quitada = toggleNumberedList(puesta.model, puesta.selection);
    assert.equal(getPlainText(quitada.model), "uno\ndos\ntres");
  });

  test("los rangos se desplazan con el prefijo de tres caracteres", () => {
    const modelo = createModel("uno\ndos", [r(0, 3, "bold")]);
    const salida = toggleNumberedList(modelo, sel(0, 7));
    assert.deepEqual(salida.model.ranges, [r(3, 6, "bold")]);
    assert.equal(salida.model.text.slice(3, 6), "uno");
  });

  test("convierte una lista con viñetas en vez de acumular prefijos", () => {
    const modelo = createModel("• uno\n• dos");
    const salida = toggleNumberedList(modelo, sel(0, 11));
    assert.equal(getPlainText(salida.model), "1. uno\n2. dos");
  });

  test("y a la inversa: numerada a viñetas", () => {
    const modelo = createModel("1. uno\n2. dos");
    const salida = toggleBulletList(modelo, sel(0, 13));
    assert.equal(getPlainText(salida.model), "• uno\n• dos");
  });

  test("al convertir de viñetas a números el estilo no se descoloca", () => {
    const modelo = createModel("• uno\n• dos", [r(2, 5, "bold")]);
    const salida = toggleNumberedList(modelo, sel(0, 11));
    assert.equal(salida.model.text.slice(3, 6), "uno");
    assert.deepEqual(salida.model.ranges, [r(3, 6, "bold")]);
  });

  test("pasa de 9 a 10 sin romper la numeración", () => {
    const lineas = Array.from({ length: 11 }, (_, i) => `l${i}`).join("\n");
    const modelo = createModel(lineas);
    const salida = toggleNumberedList(modelo, sel(0, lineas.length));
    const numeradas = getPlainText(salida.model).split("\n");
    assert.equal(numeradas[8], "9. l8");
    assert.equal(numeradas[9], "10. l9");
    assert.equal(numeradas[10], "11. l10");
  });
});

describe("pegado limpio (B-11)", () => {
  test("inserta en la posición del cursor", () => {
    const modelo = createModel("Hola mundo");
    const salida = insertPlainText(modelo, sel(5), "bonito ");
    assert.equal(getPlainText(salida.model), "Hola bonito mundo");
  });

  test("reemplaza la selección si la hay", () => {
    const modelo = createModel("Hola mundo");
    const salida = insertPlainText(modelo, sel(5, 10), "planeta");
    assert.equal(getPlainText(salida.model), "Hola planeta");
  });

  test("deja el cursor al final de lo insertado", () => {
    const salida = insertPlainText(createModel("Hola"), sel(4), " mundo");
    assert.deepEqual(salida.selection, { from: 10, to: 10 });
  });

  test("reemplazar un tramo con estilo se lleva su estilo por delante", () => {
    const modelo = createModel("Hola mundo", [r(5, 10, "bold")]);
    const salida = insertPlainText(modelo, sel(5, 10), "planeta");
    assert.deepEqual(salida.model.ranges, []);
  });

  test("conserva el estilo de lo que queda fuera de la selección", () => {
    const modelo = createModel("Hola mundo", [r(0, 4, "bold")]);
    const salida = insertPlainText(modelo, sel(5, 10), "planeta");
    assert.deepEqual(salida.model.ranges, [r(0, 4, "bold")]);
  });

  describe("cleanPastedText", () => {
    test("convierte los saltos de línea de Windows", () => {
      assert.equal(cleanPastedText("uno\r\ndos"), "uno\ndos");
    });

    test("convierte también los retornos de carro sueltos", () => {
      assert.equal(cleanPastedText("uno\rdos"), "uno\ndos");
    });

    test("deshace el formato Unicode de otra herramienta", () => {
      const ajeno = "𝐇𝐨𝐥𝐚 𝑚𝑢𝑛𝑑𝑜"; // serif bold + serif italic, no los produce este motor
      assert.equal(cleanPastedText(ajeno), "Hola mundo");
    });

    test("deshace el formato que produce este motor", () => {
      const propio = toStyled("Hola mundo", { bold: true, italic: true });
      assert.equal(cleanPastedText(propio), "Hola mundo");
    });

    test("el texto normal atraviesa la limpieza intacto", () => {
      assert.equal(
        cleanPastedText("¿Cómo estás? #Marketing @alguien"),
        "¿Cómo estás? #Marketing @alguien",
      );
    });

    test("ADR-003: lo pegado nunca entra con caracteres matemáticos", () => {
      const limpio = cleanPastedText(toStyled("áéíóú ñ ü", { bold: true }));
      for (const caracter of limpio) {
        const punto = caracter.codePointAt(0);
        assert.ok(punto < 0x1d400 || punto > 0x1d7ff);
      }
    });
  });
});

describe("historial", () => {
  const estado = (texto) => ({
    model: createModel(texto),
    selection: sel(0),
  });

  test("un historial nuevo no puede deshacer ni rehacer", () => {
    const history = createHistory();
    assert.equal(canUndo(history), false);
    assert.equal(canRedo(history), false);
    assert.equal(undo(history, estado("a")), null);
    assert.equal(redo(history, estado("a")), null);
  });

  test("deshacer devuelve el estado anterior", () => {
    const antes = estado("uno");
    const despues = estado("uno dos");
    const history = record(createHistory(), antes);

    const resultado = undo(history, despues);
    assert.deepEqual(resultado.snapshot, antes);
    assert.equal(canRedo(resultado.history), true);
  });

  test("rehacer devuelve el estado que se había deshecho", () => {
    const antes = estado("uno");
    const despues = estado("uno dos");

    const deshecho = undo(record(createHistory(), antes), despues);
    const rehecho = redo(deshecho.history, deshecho.snapshot);

    assert.deepEqual(rehecho.snapshot, despues);
  });

  test("una acción nueva vacía la pila de rehacer", () => {
    const deshecho = undo(record(createHistory(), estado("uno")), estado("dos"));
    const conAccionNueva = record(deshecho.history, estado("tres"));

    assert.equal(canRedo(conAccionNueva), false);
  });

  test("la pila se queda en el límite y descarta lo más antiguo", () => {
    let history = createHistory(3);
    for (const texto of ["a", "b", "c", "d", "e"]) {
      history = record(history, estado(texto));
    }

    assert.equal(history.past.length, 3);
    assert.deepEqual(
      history.past.map((snapshot) => snapshot.model.text),
      ["c", "d", "e"],
    );
  });

  test("no muta el historial que recibe", () => {
    const history = createHistory();
    record(history, estado("a"));
    assert.equal(history.past.length, 0);
  });
});

describe("guion completo de edición", () => {
  test("escribir, poner negrita, insertar, quitar negrita y deshacerlo todo", () => {
    let history = createHistory();
    let estado = {
      model: createModel("Hola mundo"),
      selection: sel(0, 10),
    };
    const inicial = structuredClone(estado);

    const ejecutar = (comando) => {
      history = record(history, estado);
      estado = comando(estado);
    };

    // 1. Negrita sobre "Hola".
    ejecutar((s) => toggleTextStyle(s.model, sel(0, 4), "bold"));
    assert.equal(hasStyle(estado.model, 0, 4, "bold"), "all");

    // 2. Insertar en mitad de la palabra en negrita.
    ejecutar((s) => insertPlainText(s.model, sel(2), "XX"));
    assert.equal(getPlainText(estado.model), "HoXXla mundo");
    assert.equal(
      hasStyle(estado.model, 0, 6, "bold"),
      "all",
      "lo insertado dentro del tramo hereda la negrita",
    );

    // 3. Poner viñetas.
    ejecutar((s) => toggleBulletList(s.model, sel(0, 12)));
    assert.equal(getPlainText(estado.model), "• HoXXla mundo");
    assert.deepEqual(estado.model.ranges, [r(2, 8, "bold")]);

    // 4. Quitar la negrita.
    ejecutar((s) => toggleTextStyle(s.model, sel(2, 8), "bold"));
    assert.deepEqual(estado.model.ranges, []);

    // Deshacer los cuatro pasos, uno a uno, hasta el principio.
    for (let i = 0; i < 4; i += 1) {
      const resultado = undo(history, estado);
      assert.ok(resultado, `faltaba un paso que deshacer (${i})`);
      history = resultado.history;
      estado = resultado.snapshot;
    }

    assert.deepEqual(estado, inicial);
    assert.equal(canUndo(history), false);

    // Y rehacerlos todos deja el editor donde estaba antes de deshacer.
    for (let i = 0; i < 4; i += 1) {
      const resultado = redo(history, estado);
      history = resultado.history;
      estado = resultado.snapshot;
    }

    assert.equal(getPlainText(estado.model), "• HoXXla mundo");
    assert.deepEqual(estado.model.ranges, []);
  });
});

/**
 * Estilo pendiente (X-31, S04 tarea 10).
 *
 * `applyStyleSet` es toda la parte de X-31 que se puede probar sin navegador:
 * el resto —armar el conjunto al pulsar el botón, descartarlo al mover el
 * cursor, consumirlo cuando el navegador inserta— vive en `editor.js` y se
 * verifica a mano.
 *
 * Lo que se comprueba aquí es la propiedad de la que depende todo lo demás:
 * tras pasar por `applyStyleSet`, el tramo tiene **exactamente** los estilos
 * pedidos. Ni uno más, heredado del rango que lo rodea, ni uno menos.
 */
describe("estilo pendiente: applyStyleSet (X-31)", () => {
  const TODOS = ["bold", "italic", "underline", "strikethrough"];

  const estilosDe = (modelo, from, to) =>
    TODOS.filter((estilo) => hasStyle(modelo, from, to, estilo) === "all");

  test("aplica un estilo a un tramo que no tenía ninguno", () => {
    const modelo = createModel("Hola mundo");
    const resultado = applyStyleSet(modelo, 0, 4, ["bold"]);

    assert.deepEqual(estilosDe(resultado, 0, 4), ["bold"]);
    assert.equal(hasStyle(resultado, 4, 10, "bold"), "none");
  });

  test("aplica varios estilos a la vez", () => {
    const modelo = createModel("Hola");
    const resultado = applyStyleSet(modelo, 0, 4, ["bold", "italic"]);

    assert.deepEqual(estilosDe(resultado, 0, 4), ["bold", "italic"]);
  });

  test("un conjunto vacío deja el tramo limpio", () => {
    const modelo = createModel("Hola mundo", [
      { start: 0, end: 10, style: "bold" },
    ]);
    const resultado = applyStyleSet(modelo, 0, 4, []);

    assert.equal(hasStyle(resultado, 0, 4, "bold"), "none");
    assert.equal(hasStyle(resultado, 4, 10, "bold"), "all");
  });

  test("QUITA lo que el tramo heredaba y no está en el conjunto", () => {
    // El caso simétrico, y el motivo de que la función fije el conjunto exacto
    // en vez de limitarse a añadir: con el cursor dentro de una palabra en
    // negrita, el usuario pulsa negrita y lo que escriba debe salir SIN ella.
    const modelo = createModel("negritanegrita", [
      { start: 0, end: 14, style: "bold" },
    ]);
    const resultado = applyStyleSet(modelo, 7, 10, []);

    assert.equal(hasStyle(resultado, 7, 10, "bold"), "none");
    assert.equal(hasStyle(resultado, 0, 7, "bold"), "all");
    assert.equal(hasStyle(resultado, 10, 14, "bold"), "all");
  });

  test("sustituye un estilo por otro en el mismo tramo", () => {
    const modelo = createModel("Hola", [{ start: 0, end: 4, style: "bold" }]);
    const resultado = applyStyleSet(modelo, 0, 4, ["italic"]);

    assert.deepEqual(estilosDe(resultado, 0, 4), ["italic"]);
  });

  test("no toca el texto", () => {
    const modelo = createModel("Hola mundo");
    assert.equal(
      getPlainText(applyStyleSet(modelo, 0, 4, ["bold", "underline"])),
      "Hola mundo",
    );
  });

  test("es idempotente", () => {
    const modelo = createModel("Hola mundo");
    const una = applyStyleSet(modelo, 2, 6, ["bold", "italic"]);
    const dos = applyStyleSet(una, 2, 6, ["bold", "italic"]);

    assert.deepEqual(dos, una);
  });

  test("un tramo vacío no cambia nada", () => {
    const modelo = createModel("Hola", [{ start: 0, end: 4, style: "bold" }]);
    assert.deepEqual(applyStyleSet(modelo, 2, 2, ["italic"]), modelo);
  });

  test("acepta un Set, no solo un array", () => {
    const modelo = createModel("Hola");
    const resultado = applyStyleSet(modelo, 0, 4, new Set(["bold"]));

    assert.deepEqual(estilosDe(resultado, 0, 4), ["bold"]);
  });

  test("no muta el modelo original", () => {
    const modelo = createModel("Hola", [{ start: 0, end: 4, style: "bold" }]);
    const copia = structuredClone(modelo);
    applyStyleSet(modelo, 0, 4, ["italic"]);

    assert.deepEqual(modelo, copia);
  });
});

/**
 * Arrastrar y soltar (X-32, S04 tarea 10).
 *
 * `dropText` es la parte pura: dónde acaba el texto y qué pasa con el origen.
 * Leer `dataTransfer` y averiguar sobre qué carácter ha caído el ratón son
 * cosas del DOM, y viven en `editor.js`.
 *
 * La distinción que importa es copiar contra mover. Al interceptar `drop` le
 * quitamos al navegador el borrado del origen, que hacía él solo; si no se lo
 * devolvemos, arrastrar una palabra dentro del editor la duplica.
 */
describe("arrastrar y soltar: dropText (X-32)", () => {
  test("sin origen es una copia: inserta y no borra nada", () => {
    const modelo = createModel("Hola mundo");
    const estado = dropText(modelo, 4, "XX");

    assert.equal(getPlainText(estado.model), "HolaXX mundo");
    assert.deepEqual(estado.selection, { from: 6, to: 6 });
  });

  test("inserta al principio y al final", () => {
    const modelo = createModel("Hola");
    assert.equal(getPlainText(dropText(modelo, 0, ">").model), ">Hola");
    assert.equal(getPlainText(dropText(modelo, 4, "<").model), "Hola<");
  });

  test("una posición fuera de rango se recorta", () => {
    const modelo = createModel("Hola");
    assert.equal(getPlainText(dropText(modelo, 99, "!").model), "Hola!");
    assert.equal(getPlainText(dropText(modelo, -5, "!").model), "!Hola");
  });

  test("con origen es un movimiento: borra de donde salió", () => {
    // "uno dos tres": arrastrar "uno " (0–4) hasta el final.
    const modelo = createModel("uno dos tres");
    const estado = dropText(modelo, 12, "uno ", { from: 0, to: 4 });

    assert.equal(getPlainText(estado.model), "dos tresuno ");
  });

  test("mover hacia atrás no descoloca el destino", () => {
    // El origen está detrás del destino, así que borrarlo no lo mueve.
    const modelo = createModel("uno dos tres");
    const estado = dropText(modelo, 0, "tres", { from: 8, to: 12 });

    assert.equal(getPlainText(estado.model), "tresuno dos ");
  });

  test("mover hacia delante corrige el destino por lo que se ha borrado", () => {
    // Es el punto donde es fácil equivocarse: sin corregir el destino, el
    // texto aterriza cuatro posiciones más a la derecha de lo debido.
    const modelo = createModel("uno dos tres");
    const estado = dropText(modelo, 8, "uno ", { from: 0, to: 4 });

    assert.equal(getPlainText(estado.model), "dos uno tres");
  });

  test("soltar dentro del propio tramo arrastrado no hace nada", () => {
    const modelo = createModel("uno dos tres");
    const estado = dropText(modelo, 10, "s tre", { from: 8, to: 13 });

    assert.equal(getPlainText(estado.model), "uno dos tres");
    assert.deepEqual(estado.model.ranges, []);
  });

  test("un origen colapsado se trata como copia", () => {
    const modelo = createModel("Hola");
    const estado = dropText(modelo, 4, "!", { from: 2, to: 2 });

    assert.equal(getPlainText(estado.model), "Hola!");
  });

  test("un origen al revés se ordena solo", () => {
    // La selección llega invertida en cuanto el usuario arrastra hacia atrás.
    const modelo = createModel("uno dos tres");
    const estado = dropText(modelo, 12, "uno ", { from: 4, to: 0 });

    assert.equal(getPlainText(estado.model), "dos tresuno ");
  });

  test("el texto movido entra plano, sin su estilo", () => {
    // A propósito: `dropText` recibe una cadena, no un tramo del modelo,
    // porque lo que suelta el navegador puede venir de cualquier sitio. Entrar
    // plano es exactamente lo que hace el pegado (B-11).
    const modelo = createModel("uno dos", [{ start: 0, end: 3, style: "bold" }]);
    const estado = dropText(modelo, 7, "uno", { from: 0, to: 3 });

    assert.equal(getPlainText(estado.model), " dosuno");
    assert.equal(hasStyle(estado.model, 4, 7, "bold"), "none");
  });

  test("el estilo del texto que se queda no se descoloca", () => {
    // "uno dos tres" con "tres" en negrita; se mueve "uno " al final. La
    // negrita debe seguir sobre "tres", ahora en otras posiciones.
    const modelo = createModel("uno dos tres", [
      { start: 8, end: 12, style: "bold" },
    ]);
    const estado = dropText(modelo, 12, "uno ", { from: 0, to: 4 });

    assert.equal(getPlainText(estado.model), "dos tresuno ");
    assert.equal(hasStyle(estado.model, 4, 8, "bold"), "all");
  });

  test("no muta el modelo original", () => {
    const modelo = createModel("uno dos", [{ start: 0, end: 3, style: "bold" }]);
    const copia = structuredClone(modelo);
    dropText(modelo, 7, "uno", { from: 0, to: 3 });

    assert.deepEqual(modelo, copia);
  });

  test("lo que se suelta pasa por la misma limpieza que el pegado", () => {
    // Es el motivo de existir de X-32: era la única entrada al modelo que no
    // pasaba por el teclado ni por `paste`, y ADR-003 prohíbe que un carácter
    // del bloque matemático llegue a `model.text`.
    const limpio = cleanPastedText("\u{1D5DB}ola\r\nmundo");
    const estado = dropText(createModel(""), 0, limpio);

    assert.equal(getPlainText(estado.model), "Hola\nmundo");
  });
});
