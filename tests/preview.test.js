/**
 * Tests de la vista previa de LinkedIn (S06 tarea 2, C-02).
 *
 * La vista previa tiene una sola cosa que acertar —dónde cae el corte de
 * «…ver más»— y esa decisión pasa por tres piezas separables:
 *
 *   1. `lastOffsetThatFits`  la búsqueda binaria sobre el ancho de LinkedIn.
 *   2. `snapToGrapheme`      retroceder hasta no partir una letra.
 *   3. `cutAt`               partir el texto en las dos mitades.
 *
 * Las tres son puras, y esa separación es deliberada: **lo único que un test
 * no puede simular es el layout**, así que la lógica que sí se puede probar
 * está fuera del código que mide. `measureCut` no se prueba aquí porque lo
 * único que hace, quitada la búsqueda binaria, es llamar a la API del
 * navegador; lo que le queda es la tarea 9, que se hace a mano contra el feed.
 *
 * La segunda mitad monta `setupPreview` sobre `linkedom` (ADR-020), que no
 * tiene motor de layout. Eso no es una limitación aquí sino el caso de prueba:
 * comprueba que **sin medidas la vista previa no inventa un corte**, y de paso
 * verifica el cableado del conmutador Móvil / Escritorio.
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { parseHTML } from "linkedom";

import { createModel } from "../public/static/js/editor/model.js";
import {
  cutAt,
  describeCut,
  lastOffsetThatFits,
  setupPreview,
  snapToGrapheme,
} from "../public/static/js/ui/preview.js";

/** Una `a` en negrita: U+1D5EE, par subrogado de dos unidades UTF-16. */
const BOLD_A = "\u{1D5EE}";

/** Una `á` en negrita: base matemática + acento agudo combinable. Tres unidades. */
const BOLD_A_ACUTE = "\u{1D5EE}́";

// ── 1. La búsqueda binaria ─────────────────────────────────────────────────

describe("lastOffsetThatFits", () => {
  test("encuentra la frontera exacta", () => {
    // Caben los offsets 0..40; del 41 en adelante, no.
    assert.equal(lastOffsetThatFits(100, (end) => end <= 40), 40);
  });

  test("si cabe todo, devuelve la longitud entera", () => {
    assert.equal(lastOffsetThatFits(100, () => true), 100);
  });

  test("si no cabe nada, devuelve cero", () => {
    // `fits(0)` nunca se llega a preguntar: el prefijo vacío cabe siempre.
    assert.equal(lastOffsetThatFits(100, () => false), 0);
  });

  test("con texto vacío no pregunta nada", () => {
    let calls = 0;
    assert.equal(
      lastOffsetThatFits(0, () => {
        calls += 1;
        return true;
      }),
      0,
    );
    assert.equal(calls, 0);
  });

  test("la frontera en los extremos", () => {
    assert.equal(lastOffsetThatFits(10, (end) => end <= 0), 0);
    assert.equal(lastOffsetThatFits(10, (end) => end <= 9), 9);
    assert.equal(lastOffsetThatFits(10, (end) => end <= 10), 10);
  });

  test("acierta en las 3.001 fronteras posibles de un post al límite", () => {
    // La comprobación exhaustiva es barata y cierra la clase entera de error
    // del `≤` por `<`, que desplazaría el corte una palabra sin que se note.
    for (let boundary = 0; boundary <= 3000; boundary += 1) {
      const found = lastOffsetThatFits(3000, (end) => end <= boundary);
      assert.equal(found, boundary, `frontera ${boundary}`);
    }
  });

  test("mide un post de 3.000 caracteres en una docena de preguntas", () => {
    // Es la razón de que sea binaria: preguntar carácter a carácter serían
    // 3.000 reflows por pulsación de tecla, que es el riesgo de X-27.
    let calls = 0;
    lastOffsetThatFits(3000, (end) => {
      calls += 1;
      return end <= 1234;
    });
    assert.ok(calls <= 13, `fueron ${calls} mediciones`);
  });
});

// ── 2. No partir letras por la mitad ───────────────────────────────────────

describe("snapToGrapheme", () => {
  test("un offset que ya es frontera se queda donde está", () => {
    assert.equal(snapToGrapheme("Hola mundo", 4), 4);
  });

  test("no parte un par subrogado", () => {
    // "a" + 𝗮 + "b". El offset 2 cae entre las dos mitades de 𝗮.
    const text = `a${BOLD_A}b`;
    assert.equal(text.length, 4);
    assert.equal(snapToGrapheme(text, 2), 1);
  });

  test("no deja huérfano el acento combinable", () => {
    // 𝗮́ son tres unidades: cortar en 1 o en 2 dejaría el acento solo, pintado
    // sobre la nada al principio del bloque atenuado.
    const text = `${BOLD_A_ACUTE}z`;
    assert.equal(text.length, 4);
    assert.equal(snapToGrapheme(text, 1), 0);
    assert.equal(snapToGrapheme(text, 2), 0);
    assert.equal(snapToGrapheme(text, 3), 3);
  });

  test("los extremos y los offsets absurdos", () => {
    const text = "Hola";
    assert.equal(snapToGrapheme(text, 0), 0);
    assert.equal(snapToGrapheme(text, -5), 0);
    assert.equal(snapToGrapheme(text, 4), 4);
    assert.equal(snapToGrapheme(text, 999), 4);
    assert.equal(snapToGrapheme(text, Number.NaN), 0);
  });

  test("un emoji compuesto no se parte", () => {
    const text = "a👩‍💻b";
    for (let offset = 2; offset < text.length - 1; offset += 1) {
      assert.equal(snapToGrapheme(text, offset), 1, `offset ${offset}`);
    }
  });
});

// ── 3. Partir el texto ─────────────────────────────────────────────────────

describe("cutAt", () => {
  test("parte por donde se le dice", () => {
    assert.deepEqual(cutAt("Hola mundo", 5), {
      visible: "Hola ",
      hidden: "mundo",
    });
  });

  test("el salto de línea que cierra la parte visible no se pinta dos veces", () => {
    // El corte cae tras "abc"; el "\n" es el final de esa línea y ya lo
    // representa la divisoria. Devolverlo abriría el bloque atenuado con un
    // renglón en blanco, que se lee como un fallo.
    assert.deepEqual(cutAt("abc\ndef", 3), { visible: "abc", hidden: "def" });
  });

  test("solo se descarta un salto, no un párrafo en blanco", () => {
    // Dos saltos seguidos son una línea vacía a propósito del usuario.
    assert.deepEqual(cutAt("abc\n\ndef", 3), { visible: "abc", hidden: "\ndef" });
  });

  test("el corte retrocede hasta la frontera de grafema", () => {
    const text = `Hola ${BOLD_A}${BOLD_A}`;
    // El offset 6 cae dentro del primer 𝗮.
    assert.deepEqual(cutAt(text, 6), {
      visible: "Hola ",
      hidden: `${BOLD_A}${BOLD_A}`,
    });
  });

  test("sin corte real, todo cae de un lado", () => {
    assert.deepEqual(cutAt("Hola", 0), { visible: "", hidden: "Hola" });
    assert.deepEqual(cutAt("Hola", 4), { visible: "Hola", hidden: "" });
  });
});

describe("describeCut", () => {
  test("sin corte lo dice, y es la buena noticia", () => {
    assert.equal(describeCut(null), "Se ve entero, sin «…ver más».");
  });

  test("nombra la última palabra que sobrevive", () => {
    // Es lo que hay que comparar con LinkedIn al calibrar (tarea 9), y lo que
    // al usuario le sirve: hasta aquí llega su gancho.
    assert.equal(
      describeCut({ visible: "Ayer aprendí algo raro ", hidden: "sobre Unicode" }),
      "Se corta tras «raro».",
    );
  });

  test("el corte al principio del todo", () => {
    assert.equal(
      describeCut({ visible: "   ", hidden: "todo lo demás" }),
      "El corte cae al principio del texto.",
    );
  });
});

// ── 4. El módulo montado, sin layout ───────────────────────────────────────

const MARKUP = `<!doctype html><html><body>
  <section class="preview" id="preview" data-mode="mobile" data-state="empty">
    <div id="preview-modes">
      <button type="button" data-mode="mobile" aria-pressed="true">Móvil</button>
      <button type="button" data-mode="desktop" aria-pressed="false">Escritorio</button>
    </div>
    <p id="preview-empty"></p>
    <p id="preview-visible" hidden></p>
    <p id="preview-more" hidden></p>
    <p id="preview-hidden" hidden></p>
    <p id="preview-summary" hidden></p>
  </section>
  <div id="preview-ruler" data-mode="mobile"></div>
</body></html>`;

let saved = null;

beforeEach(() => {
  saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
});

afterEach(() => {
  Object.assign(globalThis, saved);
});

function mount(model = createModel("")) {
  const { document, window } = parseHTML(MARKUP);
  globalThis.document = document;

  // `linkedom` no trae `getComputedStyle`, y `lineHeightOf` lo llama. Devolver
  // un interlineado plausible aísla el test de esa carencia: lo que se
  // comprueba aquí no es la medida, es que sin medidas no se inventa un corte.
  globalThis.getComputedStyle = () => ({ lineHeight: "20px", fontSize: "14px" });

  let current = model;

  const preview = setupPreview({
    getModel: () => current,
    getOptions: () => ({ styleCombining: true }),
    root: document.getElementById("preview"),
    ruler: document.getElementById("preview-ruler"),
    modes: document.getElementById("preview-modes"),
    visible: document.getElementById("preview-visible"),
    hidden: document.getElementById("preview-hidden"),
    more: document.getElementById("preview-more"),
    empty: document.getElementById("preview-empty"),
    summary: document.getElementById("preview-summary"),
  });

  const el = (id) => document.getElementById(id);

  return {
    preview,
    document,
    window,
    el,
    state: () => el("preview").dataset.state,
    mode: () => el("preview").dataset.mode,
    write: (text, ranges = []) => {
      current = createModel(text, ranges);
      preview.update();
    },
  };
}

describe("setupPreview", () => {
  test("sin texto enseña el marcador de posición y nada más", () => {
    const app = mount();

    assert.equal(app.state(), "empty");
    assert.equal(app.el("preview-empty").hidden, false);
    assert.equal(app.el("preview-visible").hidden, true);
    assert.equal(app.el("preview-more").hidden, true);
    assert.equal(app.el("preview-summary").hidden, true);
  });

  test("pinta la salida de serialize(), no el texto del editor", () => {
    // Es la decisión que gobierna el módulo: lo que se ve aquí son los
    // caracteres que LinkedIn va a recibir.
    const app = mount();
    app.write("Hola", [{ start: 0, end: 4, style: "bold" }]);

    assert.equal(app.el("preview-visible").textContent, "\u{1D5DB}\u{1D5FC}\u{1D5F9}\u{1D5EE}");
    assert.notEqual(app.el("preview-visible").textContent, "Hola");
  });

  test("los hashtags llegan a la vista previa sin formato (ADR-013)", () => {
    const app = mount();
    app.write("Hola #Marketing", [{ start: 0, end: 15, style: "bold" }]);

    assert.match(app.el("preview-visible").textContent, /#Marketing$/);
  });

  test("sin layout no se inventa un corte", () => {
    // `linkedom` devuelve altura cero en todo. La respuesta correcta es «no sé
    // dónde cortar», que se pinta como texto entero, no como un corte al azar.
    const app = mount();
    app.write("Un post largo ".repeat(60));

    assert.equal(app.state(), "full");
    assert.equal(app.el("preview-more").hidden, true);
    assert.equal(app.el("preview-hidden").hidden, true);
    assert.equal(app.el("preview-summary").textContent, "Se ve entero, sin «…ver más».");
  });

  test("el conmutador cambia el modo en la tarjeta y en la regla", () => {
    // En la regla es donde importa: su ancho es lo que decide el corte.
    const app = mount();
    assert.equal(app.mode(), "mobile");

    app.el("preview-modes").querySelector('[data-mode="desktop"]').click();

    assert.equal(app.mode(), "desktop");
    assert.equal(app.el("preview-ruler").dataset.mode, "desktop");
    assert.equal(
      app.el("preview-modes").querySelector('[data-mode="desktop"]').getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      app.el("preview-modes").querySelector('[data-mode="mobile"]').getAttribute("aria-pressed"),
      "false",
    );
  });

  test("arranca en Móvil, que es el corte más severo", () => {
    assert.equal(mount().mode(), "mobile");
  });

  test("un modo inventado no cambia nada", () => {
    const app = mount();
    app.preview.setMode("reloj-de-pulsera");
    assert.equal(app.mode(), "mobile");
  });
});
