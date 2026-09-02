/**
 * PintaPost — el borrador automático (S06 tarea 1, C-01, ADR-017).
 *
 * Guarda `{ text, ranges }` en `localStorage` mientras el usuario escribe y lo
 * devuelve al abrir la página. Un solo borrador: la biblioteca con varios es
 * X-06 y está aplazada.
 *
 * ── Se guarda el modelo, no el HTML ni el texto serializado ────────────────
 *
 * El modelo es la fuente de verdad (ADR-003), así que es lo único que merece
 * la pena persistir. Guardar el HTML del editor ataría el borrador a cómo
 * pintaba `render.js` el día que se guardó, y guardar la cadena serializada
 * sería peor todavía: habría que revertir Unicode al restaurar, y el texto
 * volvería al editor con caracteres del bloque matemático, que es exactamente
 * lo que ADR-003 prohíbe. Con `{ text, ranges }` restaurar es `setModel`.
 *
 * ── Enganchado por evento, como el contador ────────────────────────────────
 *
 * Escucha `pintapost:change` y no conoce al editor por dentro; lo único que
 * recibe son `getModel` y `setModel`. El *debounce* de 1 s es más largo que el
 * de 150 ms del contador a propósito: el contador tiene que responder mientras
 * se teclea porque es información en vivo, y esto solo tiene que haber
 * ocurrido antes de que se cierre la pestaña.
 *
 * Por si esa pestaña se cierra dentro de esa ventana de un segundo, hay un
 * volcado en `pagehide` y al ocultarse la página. Sin él, el último segundo de
 * escritura —justo el que más duele— se perdería.
 *
 * ── Todo acceso al almacenamiento va en `try/catch` ────────────────────────
 *
 * `localStorage` **lanza**, no devuelve `null`, cuando el navegador tiene el
 * almacenamiento bloqueado o la cuota llena. Si eso pasa, la aplicación sigue
 * funcionando entera y el panel lo dice en una línea: no guardar borradores es
 * una pérdida de comodidad, no un motivo para romper el editor.
 */

"use strict";

import { createModel } from "../editor/model.js";

/** ADR-017: solo datos del propio usuario. */
export const STORAGE_KEY = "pintapost:draft";

/**
 * Versión del formato guardado. Se escribe siempre y se exige al leer: si algún
 * día cambia la forma del modelo, un borrador viejo se ignora en vez de
 * restaurarse a medias.
 */
export const FORMAT_VERSION = 1;

/** Un segundo desde la última tecla. Ver la cabecera. */
const DEBOUNCE_MS = 1000;

/** Cada cuánto se refresca el «hace N minutos». */
const TICK_MS = 60000;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ── La parte pura: se prueba sin navegador ─────────────────────────────────

/**
 * Convierte el modelo en la cadena que se guarda.
 *
 * @param {import("../editor/model.js").Model} model
 * @param {number} savedAt marca de tiempo en milisegundos
 * @returns {string}
 */
export function encodeDraft(model, savedAt) {
  return JSON.stringify({
    v: FORMAT_VERSION,
    savedAt,
    text: model.text ?? "",
    ranges: model.ranges ?? [],
  });
}

/**
 * Lee lo que hay guardado y devuelve un modelo normalizado, o `null` si no hay
 * nada que restaurar.
 *
 * Devuelve `null` —sin lanzar— ante cualquier cosa que no sea un borrador
 * válido: la clave ausente, JSON roto, un objeto de otra forma, una versión
 * desconocida o un texto vacío. Es la única función de este archivo que ve
 * datos que no ha escrito ella misma, y lo que se juega es el arranque de la
 * aplicación entera: un borrador corrupto no puede impedir que el editor se
 * monte.
 *
 * Con los rangos es **tolerante** en vez de estricta. Si el texto está bien
 * pero la lista de rangos no, se restaura el texto sin formato: perder la
 * negrita es un fastidio, perder el post es otra cosa.
 *
 * @param {string | null} raw
 * @returns {{ model: import("../editor/model.js").Model, savedAt: number | null } | null}
 */
export function decodeDraft(raw) {
  if (typeof raw !== "string" || raw === "") return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return null;
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  if (data.v !== FORMAT_VERSION) return null;
  if (typeof data.text !== "string" || data.text.trim() === "") return null;

  // `normalize` sabe descartar rangos con estilo desconocido o límites
  // absurdos, pero accede a `range.style`: un `null` en la lista la haría
  // lanzar. Aquí se quedan solo los objetos.
  const ranges = Array.isArray(data.ranges)
    ? data.ranges.filter((range) => range !== null && typeof range === "object")
    : [];

  const savedAt =
    Number.isFinite(data.savedAt) && data.savedAt > 0 ? data.savedAt : null;

  return { model: createModel(data.text, ranges), savedAt };
}

/**
 * «hace un momento», «hace 5 minutos», «hace 2 horas», «hace 3 días».
 *
 * El futuro se trata como el presente: si el reloj del sistema se atrasa entre
 * dos cargas, `savedAt` queda por delante de `now` y «hace -3 minutos» sería
 * peor que redondear a «hace un momento».
 *
 * @param {number} savedAt
 * @param {number} [now]
 * @returns {string}
 */
export function relativeTime(savedAt, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - savedAt) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/**
 * La fecha en claro: «2 de septiembre a las 14:32». Se usa al recuperar, donde
 * «hace 3 días» no basta para reconocer qué texto es este.
 *
 * Escrita a mano y no con `Intl.DateTimeFormat` por el mismo motivo que
 * `groupThousands` en `format.js`: así el resultado no depende de qué locales
 * traiga compilado el motor, y los tests dicen lo mismo en cualquier máquina.
 *
 * @param {number} savedAt
 * @returns {string | null} `null` si la marca de tiempo no es utilizable
 */
export function formatSavedAt(savedAt) {
  if (!Number.isFinite(savedAt)) return null;

  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return null;

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${date.getDate()} de ${MONTHS[date.getMonth()]} a las ${hours}:${minutes}`;
}

// ── El almacenamiento, siempre a prueba de excepciones ─────────────────────

/**
 * Envuelve `localStorage` para una sola clave. Ninguna de sus funciones lanza.
 *
 * `available` no se congela en el primer fallo: una escritura que falla por
 * cuota llena puede volver a funcionar en cuanto el usuario borre texto, y
 * dejar el aviso puesto para siempre sería mentir.
 *
 * @param {string} key
 */
function createStorage(key) {
  let available = true;

  return {
    read() {
      try {
        const value = localStorage.getItem(key);
        available = true;
        return value;
      } catch (error) {
        available = false;
        return null;
      }
    },
    write(value) {
      try {
        localStorage.setItem(key, value);
        available = true;
        return true;
      } catch (error) {
        available = false;
        return false;
      }
    },
    remove() {
      try {
        localStorage.removeItem(key);
        available = true;
        return true;
      } catch (error) {
        available = false;
        return false;
      }
    },
    isAvailable: () => available,
  };
}

// ── El módulo ──────────────────────────────────────────────────────────────

/**
 * Arranca el borrador automático y restaura lo que hubiera guardado.
 *
 * @param {{
 *   getModel: () => import("../editor/model.js").Model,
 *   setModel: (model: { text: string, ranges: unknown[] }) => void,
 *   root?: HTMLElement | null,
 *   status?: HTMLElement | null,
 *   discard?: HTMLElement | null,
 *   confirm?: HTMLElement | null,
 *   confirmYes?: HTMLElement | null,
 *   confirmNo?: HTMLElement | null,
 *   live?: HTMLElement | null,
 * }} options
 * @returns {{ save: () => void, discard: () => void }}
 */
export function setupDrafts(options) {
  const { getModel, setModel } = options;

  const root = options.root ?? null;
  const statusEl = options.status ?? null;
  const discardEl = options.discard ?? null;
  const confirmEl = options.confirm ?? null;
  const confirmYesEl = options.confirmYes ?? null;
  const confirmNoEl = options.confirmNo ?? null;
  const liveEl = options.live ?? null;

  const storage = createStorage(STORAGE_KEY);

  let timer = null;

  /** "empty" | "saved" | "restored" | "unavailable" */
  let state = "empty";

  /** Cuándo se guardó lo que hay ahora en la clave. `null` si no hay nada. */
  let savedAt = null;

  /** ¿Hay escritura del usuario todavía sin volcar? Ver `flush`. */
  let dirty = false;

  /**
   * ¿El cambio que viene lo hemos provocado nosotros?
   *
   * `setModel` emite `pintapost:change` de forma **síncrona**, así que
   * restaurar el borrador dispararía un guardado inmediato y la marca de
   * tiempo pasaría a ser «hace un momento» aunque el texto se escribiera
   * ayer. La bandera vale porque el evento llega dentro de la misma vuelta.
   */
  let selfInflicted = false;

  // ── Pintar el panel ──────────────────────────────────────────────────────

  function statusText() {
    if (state === "unavailable") {
      return (
        "Este navegador no deja guardar borradores, así que tu texto solo vive " +
        "en esta pestaña. El editor funciona igual."
      );
    }

    if (state === "restored") {
      const when = savedAt === null ? null : formatSavedAt(savedAt);
      return when
        ? `Borrador recuperado del ${when}.`
        : "Borrador recuperado de una sesión anterior.";
    }

    if (state === "saved") {
      return `Guardado ${relativeTime(savedAt ?? Date.now())}.`;
    }

    return "Se guarda solo mientras escribes.";
  }

  /** ¿Hay algo que descartar? */
  function hasDraft() {
    return state === "saved" || state === "restored";
  }

  function render() {
    if (root) root.dataset.state = state;
    if (statusEl) statusEl.textContent = statusText();

    const confirming = confirmEl !== null && !confirmEl.hidden;
    if (discardEl) discardEl.hidden = !hasDraft() || confirming;
    if (confirmEl && !hasDraft()) confirmEl.hidden = true;
  }

  function setState(next) {
    state = next;
    render();
  }

  function announce(message) {
    if (liveEl) liveEl.textContent = message;
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  /**
   * Vuelca el modelo de ahora mismo. Un editor vacío **borra** la clave en vez
   * de guardar un borrador en blanco: haber vaciado el editor es no tener
   * borrador, y dejar `{ text: "" }` guardado convertiría el panel en un
   * «Guardado hace un momento» que no corresponde a nada.
   */
  function save() {
    const model = getModel();

    if ((model.text ?? "").trim() === "") {
      storage.remove();
      savedAt = null;
      setState(storage.isAvailable() ? "empty" : "unavailable");
      return;
    }

    const now = Date.now();
    if (!storage.write(encodeDraft(model, now))) {
      setState("unavailable");
      return;
    }

    savedAt = now;
    dirty = false;
    setState("saved");
  }

  function schedule() {
    if (selfInflicted) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, DEBOUNCE_MS);
  }

  /**
   * Guarda ya, sin esperar al *debounce*, pero **solo si hay algo escrito sin
   * guardar**. La condición no es una optimización: sin ella, abrir la página
   * y cerrarla sin tocar una tecla reescribiría la marca de tiempo del
   * borrador recuperado, y al volver diría que se escribió al cerrar la
   * pestaña en vez de cuando se escribió de verdad.
   */
  function flush() {
    if (!dirty) return;
    clearTimeout(timer);
    save();
  }

  // ── Descartar ────────────────────────────────────────────────────────────

  function discard() {
    clearTimeout(timer);
    storage.remove();
    savedAt = null;

    selfInflicted = true;
    setModel({ text: "", ranges: [] });
    selfInflicted = false;

    if (confirmEl) confirmEl.hidden = true;
    setState(storage.isAvailable() ? "empty" : "unavailable");
    announce("Borrador descartado. El editor está vacío.");
  }

  if (discardEl && confirmEl) {
    // Confirmación en el propio panel y no con `confirm()`: el diálogo nativo
    // secuestra la pestaña, no se puede escribir en español sin que el
    // navegador le anteponga la URL, y en móvil aparece pegado al borde
    // superior, lejos del botón que se acaba de pulsar.
    discardEl.addEventListener("click", () => {
      confirmEl.hidden = false;
      discardEl.hidden = true;
      if (confirmYesEl) confirmYesEl.focus();
    });

    if (confirmNoEl) {
      confirmNoEl.addEventListener("click", () => {
        confirmEl.hidden = true;
        render();
        discardEl.focus();
      });
    }

    if (confirmYesEl) confirmYesEl.addEventListener("click", discard);
  } else if (discardEl) {
    discardEl.addEventListener("click", discard);
  }

  // ── Arranque: restaurar lo que hubiera ───────────────────────────────────

  const raw = storage.read();

  if (!storage.isAvailable()) {
    setState("unavailable");
  } else {
    const draft = decodeDraft(raw);

    if (draft) {
      // No se enfoca el editor ni se mueve el cursor: al abrir la página el
      // texto tiene que estar ahí, pero sin fingir que se acaba de escribir.
      // Quien lo dice es el panel, con la fecha.
      selfInflicted = true;
      setModel(draft.model);
      selfInflicted = false;

      savedAt = draft.savedAt;
      setState("restored");
      announce(statusText());
    } else {
      // Si `raw` traía algo y no se pudo descifrar, se deja donde está. No
      // restaurarlo ya es la decisión; borrarlo además destruiría un texto que
      // todavía se podría rescatar a mano, y la primera escritura lo va a
      // sobrescribir de todos modos.
      setState("empty");
    }
  }

  document.addEventListener("pintapost:change", schedule);

  // El último segundo de escritura, a salvo. `pagehide` es el evento que sí se
  // dispara en iOS, donde `beforeunload` no llega nunca.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  // El «hace N minutos» envejece solo, sin que nadie toque el teclado.
  setInterval(() => {
    if (state === "saved") render();
  }, TICK_MS);

  // `save` sin la condición de `flush`: quien la llama a mano quiere guardar,
  // no preguntar si hace falta.
  return {
    save: () => {
      clearTimeout(timer);
      save();
    },
    discard,
  };
}
