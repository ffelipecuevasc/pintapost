/**
 * Tests del borrador automático (S06 tarea 1, C-01).
 *
 * Dos mitades, y la segunda es la que justifica el archivo.
 *
 * La primera cubre `encodeDraft` / `decodeDraft` / `relativeTime` /
 * `formatSavedAt`, que son puras y se prueban sin nada alrededor.
 *
 * La segunda monta `setupDrafts` sobre `linkedom` (ADR-020) con un
 * `localStorage` falso, y existe por una razón concreta: **este módulo es el
 * único de la aplicación que lee datos que no ha escrito él**. La clave la
 * puede haber dejado una versión anterior, la puede haber tocado alguien a
 * mano, o puede estar a medias porque el navegador se cerró escribiendo. Y lo
 * que se juega no es el panel de borradores: `setupDrafts` corre durante el
 * arranque, así que una excepción suya se lleva por delante el editor entero.
 *
 * De ahí que los casos importantes sean todos negativos: JSON roto, forma
 * equivocada, `localStorage` que lanza. Ninguno puede propagar una excepción y
 * en ninguno puede perderse texto que se pudiera salvar.
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { parseHTML } from "linkedom";

import { createModel } from "../public/static/js/editor/model.js";
import {
  FORMAT_VERSION,
  STORAGE_KEY,
  decodeDraft,
  encodeDraft,
  formatSavedAt,
  relativeTime,
  setupDrafts,
} from "../public/static/js/ui/drafts.js";

const r = (start, end, style) => ({ start, end, style });

/** Una marca de tiempo cualquiera, pero fija: 2 de septiembre de 2026, 14:32. */
const SAVED_AT = new Date(2026, 8, 2, 14, 32, 0).getTime();

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ── La parte pura ──────────────────────────────────────────────────────────

describe("encodeDraft / decodeDraft", () => {
  test("un modelo con formato sobrevive al viaje de ida y vuelta", () => {
    const model = createModel("Hola mundo en negrita", [
      r(0, 4, "bold"),
      r(5, 10, "italic"),
    ]);

    const draft = decodeDraft(encodeDraft(model, SAVED_AT));

    assert.deepEqual(draft.model, model);
    assert.equal(draft.savedAt, SAVED_AT);
  });

  test("el texto con acentos y emojis vuelve intacto", () => {
    const model = createModel("Una canción del ñandú 🐦 ¿qué tal?", [
      r(4, 12, "bold"),
    ]);

    assert.deepEqual(decodeDraft(encodeDraft(model, SAVED_AT)).model, model);
  });

  test("sin clave guardada no hay borrador", () => {
    assert.equal(decodeDraft(null), null);
    assert.equal(decodeDraft(""), null);
    assert.equal(decodeDraft(undefined), null);
  });

  test("un borrador vacío no es un borrador", () => {
    assert.equal(decodeDraft(encodeDraft(createModel(""), SAVED_AT)), null);
  });

  test("un borrador de solo espacios y saltos tampoco", () => {
    // Restaurarlo dejaría el panel diciendo «Borrador recuperado» sobre un
    // editor que se ve vacío, que es la peor combinación posible.
    assert.equal(
      decodeDraft(encodeDraft(createModel("   \n\n  \t "), SAVED_AT)),
      null,
    );
  });

  test("el JSON roto no lanza: devuelve null", () => {
    assert.equal(decodeDraft("{ esto no es json"), null);
    assert.equal(decodeDraft("{\"text\": \"a medio escri"), null);
  });

  test("un JSON válido que no es un objeto tampoco vale", () => {
    assert.equal(decodeDraft("null"), null);
    assert.equal(decodeDraft("42"), null);
    assert.equal(decodeDraft('"una cadena"'), null);
    assert.equal(decodeDraft("[1, 2, 3]"), null);
  });

  test("una versión de formato desconocida se ignora entera", () => {
    const raw = JSON.stringify({ v: 99, savedAt: SAVED_AT, text: "Hola", ranges: [] });
    assert.equal(decodeDraft(raw), null);

    // Y la ausencia de versión también: la escribe siempre `encodeDraft`.
    const sinVersion = JSON.stringify({ savedAt: SAVED_AT, text: "Hola", ranges: [] });
    assert.equal(decodeDraft(sinVersion), null);
  });

  test("un `text` que no es una cadena se descarta", () => {
    for (const text of [42, null, ["Hola"], { a: 1 }]) {
      const raw = JSON.stringify({ v: FORMAT_VERSION, savedAt: SAVED_AT, text, ranges: [] });
      assert.equal(decodeDraft(raw), null, `text = ${JSON.stringify(text)}`);
    }
  });

  test("si los rangos están corruptos se salva el texto sin formato", () => {
    // La decisión de la cabecera de `decodeDraft`: perder la negrita es un
    // fastidio, perder el post es otra cosa.
    const raw = JSON.stringify({
      v: FORMAT_VERSION,
      savedAt: SAVED_AT,
      text: "Un post que costó escribir",
      ranges: "esto no es una lista",
    });

    const draft = decodeDraft(raw);
    assert.equal(draft.model.text, "Un post que costó escribir");
    assert.deepEqual(draft.model.ranges, []);
  });

  test("los rangos basura se filtran sin lanzar", () => {
    // `null` dentro de la lista es el caso peligroso: `normalize` accede a
    // `range.style` y reventaría durante el arranque.
    const raw = JSON.stringify({
      v: FORMAT_VERSION,
      savedAt: SAVED_AT,
      text: "Hola mundo",
      ranges: [null, 7, "bold", r(0, 4, "bold"), { start: 1 }, r(2, 6, "inventado")],
    });

    const draft = decodeDraft(raw);
    assert.deepEqual(draft.model.ranges, [r(0, 4, "bold")]);
  });

  test("los rangos fuera de los límites del texto se recortan", () => {
    const raw = JSON.stringify({
      v: FORMAT_VERSION,
      savedAt: SAVED_AT,
      text: "Hola",
      ranges: [r(0, 999, "bold"), r(-5, 2, "italic")],
    });

    // Salen en el orden canónico de `normalize`: por `start`, y a igualdad por
    // el orden de `STYLES`, donde `bold` va antes que `italic`.
    const draft = decodeDraft(raw);
    assert.deepEqual(draft.model.ranges, [r(0, 4, "bold"), r(0, 2, "italic")]);
  });

  test("sin marca de tiempo utilizable el borrador se restaura igual", () => {
    for (const savedAt of [undefined, null, "ayer", -1, 0, Number.NaN]) {
      const raw = JSON.stringify({ v: FORMAT_VERSION, savedAt, text: "Hola", ranges: [] });
      const draft = decodeDraft(raw);
      assert.equal(draft.savedAt, null, `savedAt = ${String(savedAt)}`);
      assert.equal(draft.model.text, "Hola");
    }
  });
});

describe("relativeTime", () => {
  test("menos de un minuto es «hace un momento»", () => {
    assert.equal(relativeTime(SAVED_AT, SAVED_AT), "hace un momento");
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + 59000), "hace un momento");
  });

  test("el singular del minuto", () => {
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + MINUTE), "hace 1 minuto");
  });

  test("los minutos", () => {
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + 5 * MINUTE), "hace 5 minutos");
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + 59 * MINUTE), "hace 59 minutos");
  });

  test("las horas, con su singular", () => {
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + HOUR), "hace 1 hora");
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + 3 * HOUR), "hace 3 horas");
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + 23 * HOUR), "hace 23 horas");
  });

  test("los días, con su singular", () => {
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + DAY), "hace 1 día");
    assert.equal(relativeTime(SAVED_AT, SAVED_AT + 9 * DAY), "hace 9 días");
  });

  test("un guardado en el futuro no dice «hace -3 minutos»", () => {
    // Pasa de verdad: basta con que el reloj del sistema se atrase entre dos
    // cargas de la página.
    assert.equal(relativeTime(SAVED_AT, SAVED_AT - 3 * MINUTE), "hace un momento");
  });
});

describe("formatSavedAt", () => {
  test("la fecha en claro, en español", () => {
    assert.equal(formatSavedAt(SAVED_AT), "2 de septiembre a las 14:32");
  });

  test("la hora se rellena con cero a la izquierda", () => {
    const madrugada = new Date(2026, 0, 9, 7, 5, 0).getTime();
    assert.equal(formatSavedAt(madrugada), "9 de enero a las 07:05");
  });

  test("una marca de tiempo inutilizable devuelve null", () => {
    assert.equal(formatSavedAt(Number.NaN), null);
    assert.equal(formatSavedAt(null), null);
    assert.equal(formatSavedAt("ayer"), null);
  });
});

// ── El módulo montado sobre un DOM real ────────────────────────────────────

/**
 * Un `localStorage` de mentira. `fail` decide cuáles de las tres operaciones
 * lanzan, que es como se comporta el de verdad —lanza, no devuelve `null`— en
 * ventana privada o con la cuota llena.
 *
 * @param {{ initial?: Record<string, string>, fail?: string[] }} [options]
 */
function fakeStorage(options = {}) {
  const data = new Map(Object.entries(options.initial ?? {}));
  const fail = new Set(options.fail ?? []);

  const boom = (operation) => {
    if (fail.has(operation)) {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    }
  };

  return {
    data,
    getItem(key) {
      boom("getItem");
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      boom("setItem");
      data.set(key, String(value));
    },
    removeItem(key) {
      boom("removeItem");
      data.delete(key);
    },
  };
}

const MARKUP = `<!doctype html><html><body>
  <section id="drafts" data-state="empty">
    <p id="drafts-status"></p>
    <button id="drafts-discard" hidden></button>
    <div id="drafts-confirm" hidden>
      <button id="drafts-discard-yes"></button>
      <button id="drafts-discard-no"></button>
    </div>
    <p id="drafts-live"></p>
  </section>
</body></html>`;

/** Lo que había en los globales antes de que este archivo los tocara. */
let saved = null;

beforeEach(() => {
  saved = {
    document: globalThis.document,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    setInterval: globalThis.setInterval,
  };

  // El «hace N minutos» se refresca con un `setInterval` que nadie cancela:
  // en el navegador dura lo que la pestaña, pero aquí mantendría vivo el bucle
  // de eventos y `node --test` no terminaría nunca.
  globalThis.setInterval = () => 0;
});

afterEach(() => {
  Object.assign(globalThis, saved);
});

/**
 * Monta `setupDrafts` sobre un DOM nuevo y devuelve con qué hablarle.
 *
 * @param {{ storage?: ReturnType<typeof fakeStorage>, model?: object }} [options]
 */
function mount(options = {}) {
  const storage = options.storage ?? fakeStorage();
  const { document, window } = parseHTML(MARKUP);

  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = storage;

  let model = options.model ?? createModel("");
  const applied = [];

  const drafts = setupDrafts({
    getModel: () => model,
    setModel: (next) => {
      applied.push(next);
      model = createModel(next.text, next.ranges);
    },
    root: document.getElementById("drafts"),
    status: document.getElementById("drafts-status"),
    discard: document.getElementById("drafts-discard"),
    confirm: document.getElementById("drafts-confirm"),
    confirmYes: document.getElementById("drafts-discard-yes"),
    confirmNo: document.getElementById("drafts-discard-no"),
    live: document.getElementById("drafts-live"),
  });

  const el = (id) => document.getElementById(id);

  return {
    drafts,
    storage,
    applied,
    document,
    window,
    state: () => el("drafts").dataset.state,
    status: () => el("drafts-status").textContent,
    live: () => el("drafts-live").textContent,
    el,
    getModel: () => model,
    write: (text, ranges = []) => {
      model = createModel(text, ranges);
    },
  };
}

describe("setupDrafts: el arranque", () => {
  test("sin nada guardado, el editor no se toca", () => {
    const app = mount();

    assert.deepEqual(app.applied, []);
    assert.equal(app.state(), "empty");
    assert.equal(app.status(), "Se guarda solo mientras escribes.");
    assert.equal(app.el("drafts-discard").hidden, true);
  });

  test("con un borrador guardado, se restaura con su fecha", () => {
    const model = createModel("Un post de ayer", [r(0, 2, "bold")]);
    const app = mount({
      storage: fakeStorage({ initial: { [STORAGE_KEY]: encodeDraft(model, SAVED_AT) } }),
    });

    assert.equal(app.applied.length, 1);
    assert.deepEqual(app.getModel(), model);
    assert.equal(app.state(), "restored");
    assert.equal(app.status(), "Borrador recuperado del 2 de septiembre a las 14:32.");

    // Y se puede descartar desde el primer momento.
    assert.equal(app.el("drafts-discard").hidden, false);
  });

  test("restaurar no vuelve a guardar: la fecha no se pisa a sí misma", () => {
    // `setModel` emite `pintapost:change` de forma síncrona. Sin la guardia de
    // `selfInflicted`, el borrador de ayer pasaría a estar «guardado hace un
    // momento» sin que el usuario haya escrito una letra.
    const guardado = encodeDraft(createModel("Un post de ayer"), SAVED_AT);
    const app = mount({ storage: fakeStorage({ initial: { [STORAGE_KEY]: guardado } }) });

    assert.equal(app.storage.data.get(STORAGE_KEY), guardado);
    assert.equal(app.state(), "restored");
  });

  test("cerrar la pestaña sin escribir no reescribe la fecha del borrador", () => {
    // El volcado de `pagehide` está para salvar el último segundo de escritura.
    // Si además se disparara sin nada escrito, abrir la página y cerrarla
    // dejaría el borrador de ayer fechado al cierre de la pestaña.
    const guardado = encodeDraft(createModel("Un post de ayer"), SAVED_AT);
    const app = mount({ storage: fakeStorage({ initial: { [STORAGE_KEY]: guardado } }) });

    app.window.dispatchEvent(new app.window.Event("pagehide"));

    assert.equal(app.storage.data.get(STORAGE_KEY), guardado);
    assert.equal(app.status(), "Borrador recuperado del 2 de septiembre a las 14:32.");
  });

  test("un borrador sin fecha se restaura, y el panel lo dice sin inventarse una", () => {
    const raw = JSON.stringify({ v: FORMAT_VERSION, text: "Hola", ranges: [] });
    const app = mount({ storage: fakeStorage({ initial: { [STORAGE_KEY]: raw } }) });

    assert.equal(app.getModel().text, "Hola");
    assert.equal(app.status(), "Borrador recuperado de una sesión anterior.");
  });

  test("un dato corrupto no rompe el arranque ni se borra", () => {
    const app = mount({
      storage: fakeStorage({ initial: { [STORAGE_KEY]: "{ roto a medias" } }),
    });

    assert.deepEqual(app.applied, []);
    assert.equal(app.state(), "empty");

    // Se deja donde está: no se ha podido restaurar, pero todavía se puede
    // rescatar a mano desde las herramientas del navegador.
    assert.equal(app.storage.data.get(STORAGE_KEY), "{ roto a medias");
  });

  test("un borrador de otra versión no se restaura a medias", () => {
    const raw = JSON.stringify({ v: 99, text: "De otra época", ranges: [] });
    const app = mount({ storage: fakeStorage({ initial: { [STORAGE_KEY]: raw } }) });

    assert.deepEqual(app.applied, []);
    assert.equal(app.state(), "empty");
  });
});

describe("setupDrafts: guardar", () => {
  test("guarda lo que hay en el editor", () => {
    const app = mount();
    app.write("Hola mundo", [r(0, 4, "bold")]);
    app.drafts.save();

    assert.equal(app.state(), "saved");
    assert.match(app.status(), /^Guardado hace un momento\.$/);

    const draft = decodeDraft(app.storage.data.get(STORAGE_KEY));
    assert.deepEqual(draft.model, createModel("Hola mundo", [r(0, 4, "bold")]));
  });

  test("`pintapost:change` dispara el guardado tras el retardo", async () => {
    const app = mount();
    app.write("Escribiendo");
    app.document.dispatchEvent(new app.document.defaultView.CustomEvent("pintapost:change"));

    // Antes del segundo todavía no hay nada.
    assert.equal(app.storage.data.has(STORAGE_KEY), false);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(decodeDraft(app.storage.data.get(STORAGE_KEY)).model.text, "Escribiendo");
  });

  test("vaciar el editor borra la clave en vez de guardar un borrador en blanco", () => {
    const app = mount();
    app.write("Algo");
    app.drafts.save();
    assert.equal(app.storage.data.has(STORAGE_KEY), true);

    app.write("");
    app.drafts.save();

    assert.equal(app.storage.data.has(STORAGE_KEY), false);
    assert.equal(app.state(), "empty");
  });
});

describe("setupDrafts: descartar", () => {
  test("pide confirmación antes de vaciar nada", () => {
    const app = mount();
    app.write("Un post que costó escribir");
    app.drafts.save();

    app.el("drafts-discard").click();

    assert.equal(app.el("drafts-confirm").hidden, false);
    assert.equal(app.el("drafts-discard").hidden, true);

    // Nada se ha tocado todavía.
    assert.equal(app.storage.data.has(STORAGE_KEY), true);
    assert.deepEqual(app.applied, []);
  });

  test("cancelar deja el borrador donde estaba", () => {
    const app = mount();
    app.write("Un post que costó escribir");
    app.drafts.save();

    app.el("drafts-discard").click();
    app.el("drafts-discard-no").click();

    assert.equal(app.el("drafts-confirm").hidden, true);
    assert.equal(app.el("drafts-discard").hidden, false);
    assert.equal(app.storage.data.has(STORAGE_KEY), true);
    assert.equal(app.state(), "saved");
  });

  test("confirmar vacía el editor, borra la clave y lo anuncia", () => {
    const app = mount();
    app.write("Un post que costó escribir");
    app.drafts.save();

    app.el("drafts-discard").click();
    app.el("drafts-discard-yes").click();

    assert.equal(app.storage.data.has(STORAGE_KEY), false);
    assert.deepEqual(app.applied, [{ text: "", ranges: [] }]);
    assert.equal(app.getModel().text, "");
    assert.equal(app.state(), "empty");
    assert.equal(app.el("drafts-discard").hidden, true);
    assert.match(app.live(), /descartado/i);
  });
});

describe("setupDrafts: sin almacenamiento", () => {
  test("un `localStorage` que lanza al leer no impide arrancar", () => {
    const app = mount({ storage: fakeStorage({ fail: ["getItem"] }) });

    assert.equal(app.state(), "unavailable");
    assert.match(app.status(), /no deja guardar borradores/);
    assert.match(app.status(), /El editor funciona igual/);
  });

  test("un `localStorage` que lanza al escribir avisa y sigue", () => {
    const app = mount({ storage: fakeStorage({ fail: ["setItem"] }) });

    // Leer sí funciona, así que arranca normal.
    assert.equal(app.state(), "empty");

    app.write("Hola");
    app.drafts.save();

    assert.equal(app.state(), "unavailable");
    assert.equal(app.storage.data.has(STORAGE_KEY), false);
  });

  test("la cuota que se libera devuelve el panel a la normalidad", () => {
    // `available` no se congela en el primer fallo: borrar texto puede hacer
    // sitio, y dejar el aviso puesto para siempre sería mentir.
    const storage = fakeStorage({ fail: ["setItem"] });
    const app = mount({ storage });

    app.write("Hola");
    app.drafts.save();
    assert.equal(app.state(), "unavailable");

    storage.setItem = (key, value) => storage.data.set(key, String(value));
    app.drafts.save();

    assert.equal(app.state(), "saved");
  });

  test("descartar tampoco lanza si el borrado falla", () => {
    const app = mount({ storage: fakeStorage({ fail: ["removeItem"] }) });

    app.write("Hola");
    app.drafts.save();
    app.el("drafts-discard").click();

    assert.doesNotThrow(() => app.el("drafts-discard-yes").click());
    assert.equal(app.getModel().text, "");
  });
});
