/**
 * PintaPost — el portapapeles (S05 tareas 5 y 6, B-13/B-14/B-15).
 *
 * Dos cosas: `copyText`, que escribe en el portapapeles bajando por tres
 * caminos hasta que uno funciona, y `setupCopy`, que engancha los dos botones
 * de la interfaz.
 *
 * ── Ni un `await` antes de escribir (H-17) ─────────────────────────────────
 *
 * Es la regla que gobierna este archivo y la única que no se puede relajar.
 *
 * Safari de iOS concede permiso para escribir en el portapapeles solo mientras
 * dura el contexto del gesto del usuario, y ese contexto se pierde en cuanto la
 * pila de llamadas se vacía. Si entre el `click` y `writeText` hay un `await`,
 * la escritura falla **en silencio**: sin excepción, sin rechazo y sin nada que
 * mostrarle al usuario. El botón parece funcionar y el portapapeles se queda
 * como estaba.
 *
 * Por eso `serialize` es síncrona y por eso el manejador del `click` la llama
 * directamente y pasa el resultado a `writeText` sin esperar a nada:
 *
 *   boton.addEventListener("click", () => {
 *     const texto = serialize(modelo, opciones);   // síncrono
 *     copyText(texto).then(ok).catch(planB);
 *   });
 *
 * Si algún día la serialización se volviera asíncrona, la salida no es meter un
 * `await` aquí sino pasarle una Promise a `ClipboardItem`, que es la forma que
 * la API prevé para ese caso.
 *
 * ── Tres caminos, y ninguno termina en un error sin salida ─────────────────
 *
 * 1. `navigator.clipboard.writeText`. Lo que funciona en todo lo moderno, y lo
 *    único que funciona en un contexto seguro sin sorpresas.
 * 2. Un `<textarea>` fuera de pantalla más `document.execCommand("copy")`.
 *    Obsoleto desde hace años, pero es lo que queda cuando la API moderna no
 *    está: por `http://` en la red local, en WebViews antiguos y en navegadores
 *    sin permiso concedido. Se mantiene porque el coste es veinte líneas y la
 *    alternativa es un usuario que no puede copiar.
 * 3. Enseñar el texto ya seleccionado con la instrucción de copiarlo a mano.
 *    No es un mensaje de error: es la salida manual, y llega con el texto
 *    correcto delante y seleccionado. Un fallo del portapapeles nunca deja al
 *    usuario sin forma de llevarse su post.
 */

"use strict";

import { serialize } from "./serialize.js";

/** Cuánto dura la confirmación del botón antes de volver a su estado normal. */
const FEEDBACK_MS = 2000;

/** El icono con el que el botón confirma. Ver `swapIcon`. */
const ICONS = {
  copy: "/static/assets/icons.svg#copy",
  check: "/static/assets/icons.svg#check",
};

/**
 * Escribe `text` en el portapapeles.
 *
 * **Llámala desde dentro del manejador del gesto, sin `await` por delante.**
 * Ver la cabecera.
 *
 * @param {string} text
 * @returns {Promise<"clipboard" | "legacy">} Con qué camino se consiguió. Se
 *   rechaza solo cuando han fallado los dos, y entonces le toca a quien llama
 *   ofrecer el camino manual.
 */
export function copyText(text) {
  if (typeof text !== "string" || text === "") {
    return Promise.reject(new Error("No hay nada que copiar."));
  }

  const clipboard = globalThis.navigator?.clipboard;

  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      // Sin `await`: se devuelve la promesa de `writeText` tal cual, así que la
      // llamada ocurre dentro del gesto. El `catch` baja al camino heredado, ya
      // fuera del gesto; en iOS eso rara vez funcionará, pero no empeora nada y
      // en escritorio recupera el caso de permiso denegado.
      return clipboard.writeText(text).then(
        () => "clipboard",
        () => legacyCopy(text),
      );
    } catch (error) {
      // Algunos WebViews lanzan de forma síncrona en lugar de rechazar.
      return legacyCopy(text);
    }
  }

  return legacyCopy(text);
}

/**
 * Camino 2: `<textarea>` fuera de pantalla y `execCommand`.
 *
 * El `<textarea>` no puede tener `display: none` ni `hidden` —un elemento sin
 * caja no se puede seleccionar— así que se aparta con posición absoluta. Se usa
 * `textarea` y no `input` porque conserva los saltos de línea, que en un post
 * de LinkedIn son la mitad del formato.
 *
 * @param {string} text
 * @returns {Promise<"legacy">}
 */
function legacyCopy(text) {
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.className = "offscreen-field";
    document.body.append(field);

    field.select();
    field.setSelectionRange(0, text.length);

    const ok = document.execCommand("copy");
    field.remove();

    return ok
      ? Promise.resolve("legacy")
      : Promise.reject(new Error("El navegador rechazó la copia."));
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Engancha los dos botones de copiado.
 *
 * @param {{
 *   getModel: () => import("../editor/model.js").Model,
 *   getOptions: () => { styleCombining: boolean },
 *   styled?: HTMLElement | null,
 *   plain?: HTMLElement | null,
 *   status?: HTMLElement | null,
 *   manual?: HTMLElement | null,
 *   manualField?: HTMLTextAreaElement | null,
 * }} options
 * @returns {{ refresh: () => void }}
 */
export function setupCopy(options) {
  const { getModel, getOptions } = options;

  const styled = options.styled ?? null;
  const plain = options.plain ?? null;
  const status = options.status ?? null;
  const manual = options.manual ?? null;
  const manualField = options.manualField ?? null;

  /** Temporizadores de la confirmación, uno por botón. */
  const timers = new Map();

  /**
   * Confirma en el propio botón: etiqueta, icono y anuncio para el lector de
   * pantalla. El texto visible cambia, así que el aviso tiene que ir además a
   * una región `aria-live`: quien no ve el botón no se entera de otro modo.
   */
  function confirm(button, message) {
    if (!button) return;

    const label = button.querySelector("[data-label]");
    if (label) {
      if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = label.textContent;
      }
      label.textContent = "¡Copiado!";
    }
    swapIcon(button, ICONS.check);
    announce(message);

    clearTimeout(timers.get(button));
    timers.set(
      button,
      setTimeout(() => {
        if (label && button.dataset.originalLabel) {
          label.textContent = button.dataset.originalLabel;
        }
        swapIcon(button, ICONS.copy);
        timers.delete(button);
      }, FEEDBACK_MS),
    );
  }

  function swapIcon(button, href) {
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", href);
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  /** Camino 3: el texto delante, seleccionado y con la instrucción. */
  function showManual(text) {
    if (!manual || !manualField) {
      announce("No se pudo copiar. Selecciona el texto del editor a mano.");
      return;
    }

    manualField.value = text;
    manual.hidden = false;

    // Este es el último camino que le queda al usuario, así que no se le puede
    // permitir fallar: si `focus` o `select` no existieran o lanzaran, el texto
    // ya está delante y solo se pierde la comodidad de tenerlo seleccionado.
    try {
      manualField.focus();
      manualField.select?.();
    } catch (error) {
      // Sin seleccionar, pero visible.
    }

    announce("No se pudo copiar automáticamente. Mantén pulsado y elige Copiar.");
  }

  function hideManual() {
    if (manual) manual.hidden = true;
  }

  /**
   * El manejador de los dos botones. `build` decide qué cadena se copia, y es
   * lo único que los diferencia: el principal serializa, el secundario devuelve
   * `model.text`.
   *
   * Nada de esto es `async`. Ver la cabecera.
   */
  function handler(button, build, message) {
    return () => {
      const model = getModel();
      const text = build(model);
      if (text === "") return;

      hideManual();
      copyText(text).then(
        () => confirm(button, message),
        () => showManual(text),
      );
    };
  }

  if (styled) {
    styled.addEventListener(
      "click",
      handler(
        styled,
        (model) => serialize(model, getOptions()),
        "Texto con formato copiado al portapapeles.",
      ),
    );
  }

  if (plain) {
    plain.addEventListener(
      "click",
      // ADR-003 en su forma más barata: el texto original nunca se destruyó, así
      // que "copiar sin formato" no tiene que deshacer nada.
      handler(
        plain,
        (model) => model.text,
        "Texto sin formato copiado al portapapeles.",
      ),
    );
  }

  /** Con el editor vacío no hay nada que copiar y los botones se apagan. */
  function refresh() {
    const empty = (getModel().text ?? "").trim() === "";
    if (styled) styled.disabled = empty;
    if (plain) plain.disabled = empty;
    if (empty) hideManual();
  }

  document.addEventListener("pintapost:change", refresh);
  refresh();

  return { refresh };
}
