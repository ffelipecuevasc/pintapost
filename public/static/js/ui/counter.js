/**
 * PintaPost — el contador dual (S05 tarea 4, B-16, ADR-012).
 *
 * Dos números, y el segundo es el que manda:
 *
 *   1.240 caracteres  ·  1.890 / 3.000 en LinkedIn
 *
 * ── Por qué dos ────────────────────────────────────────────────────────────
 *
 * Porque la cifra que le importa al usuario y la cifra que le importa a
 * LinkedIn no son la misma, y la diferencia no es pequeña.
 *
 * El primer número son los **grafemas** de `model.text`: las letras que el
 * usuario ve, escribe y borra de un golpe de retroceso. El segundo son las
 * **unidades UTF-16** de la cadena ya serializada, que es como cuenta LinkedIn
 * —verificado empíricamente en el S03, B-05— y donde una letra en negrita vale
 * 2 y una vocal acentuada en negrita vale 3.
 *
 * Un post enteramente en negrita agota el límite de 3.000 a menos de la mitad
 * de su longitud aparente. Sin el segundo número, el usuario ve 1.400
 * caracteres, LinkedIn le trunca el texto y no hay nada en pantalla que
 * explique por qué. De ahí que el protagonista sea el segundo y que el aviso
 * llegue **antes** del límite, no al cruzarlo: a 3.000 ya es tarde, y el
 * objetivo es que reaccione mientras todavía está escribiendo.
 *
 * ── Enganchado por evento, no por dentro ───────────────────────────────────
 *
 * Escucha `pintapost:change`, que el editor emite sin saber quién lo oye, y
 * `pintapost:settings`, que emite la casilla de compatibilidad. El editor no
 * sabe que este archivo existe, y eso es lo que permite que el S04 siguiera
 * cerrado mientras se escribía el S05.
 *
 * El *debounce* de 150 ms no es cosmético: serializar es O(n) sobre el texto
 * entero, y hacerlo en cada pulsación de un post de 3.000 caracteres es el
 * riesgo que anticipaba X-27. Con el retardo, una ráfaga de escritura produce
 * una sola serialización. El cambio de la casilla no se retrasa: es un clic
 * aislado y la respuesta tiene que ser inmediata.
 */

"use strict";

import { count } from "../format/counting.js";
import { serialize } from "../export/serialize.js";
import { characters, groupThousands } from "./format.js";

/** El límite de LinkedIn para el cuerpo de una publicación. */
const LIMIT = 3000;

/** El 90 % del límite: a partir de aquí se avisa. */
const WARN = 2700;

const DEBOUNCE_MS = 150;

/**
 * Arranca el contador.
 *
 * @param {{
 *   getModel: () => import("../editor/model.js").Model,
 *   getOptions: () => { styleCombining: boolean },
 *   root?: HTMLElement | null,
 *   plain?: HTMLElement | null,
 *   styled?: HTMLElement | null,
 *   hint?: HTMLElement | null,
 *   status?: HTMLElement | null,
 * }} options
 * @returns {{ update: () => void }}
 */
export function setupCounter(options) {
  const { getModel, getOptions } = options;

  const root = options.root ?? null;
  const plainEl = options.plain ?? null;
  const styledEl = options.styled ?? null;
  const hintEl = options.hint ?? null;
  const statusEl = options.status ?? null;

  let timer = null;

  /**
   * El último estado anunciado. El texto visible se reescribe en cada pasada
   * —los números tienen que ser correctos— pero al lector de pantalla solo se
   * le habla cuando el estado **cambia**. Anunciar la cifra en cada pulsación
   * convertiría la región `aria-live` en ruido continuo y el usuario acabaría
   * ignorándola justo el día que importa.
   */
  let lastState = null;

  function update() {
    const model = getModel();
    const text = model.text ?? "";

    const plain = count(text).graphemes;
    const styled = serialize(model, getOptions()).length;

    if (plainEl) plainEl.textContent = characters(plain);
    if (styledEl) {
      styledEl.textContent =
        `${groupThousands(styled)} / ${groupThousands(LIMIT)} en LinkedIn`;
    }

    const state =
      styled > LIMIT ? "error" : styled >= WARN ? "warning" : "normal";

    if (root) root.dataset.state = state;

    if (hintEl) {
      hintEl.textContent = hintFor(state, styled);
      hintEl.hidden = state === "normal";
    }

    if (statusEl && state !== lastState) {
      statusEl.textContent = announcementFor(state);
    }
    lastState = state;
  }

  /**
   * La explicación de la causa. El usuario no puede adivinarla: en pantalla ve
   * un texto corto y el contador le dice que va por 2.800, y esa distancia solo
   * se entiende si alguien nombra el motivo.
   */
  function hintFor(state, styled) {
    if (state === "warning") {
      return (
        `El formato ocupa espacio: tu texto usa ${groupThousands(styled)} de ` +
        `los ${groupThousands(LIMIT)} caracteres de LinkedIn.`
      );
    }
    if (state === "error") {
      // "No te dejará publicar" y no "cortará el texto": ADR-012 lo comprobó,
      // LinkedIn avisa del exceso y bloquea la publicación en lugar de truncar
      // en silencio. Menos grave, pero conviene decirle al usuario lo que de
      // verdad va a pasar.
      return (
        `Te has pasado: ${groupThousands(styled)} de ${groupThousands(LIMIT)} ` +
        "caracteres. LinkedIn no te dejará publicar hasta que recortes."
      );
    }
    return "";
  }

  function announcementFor(state) {
    if (state === "warning") return "Te acercas al límite de caracteres de LinkedIn.";
    if (state === "error") return "Has superado el límite de 3.000 caracteres de LinkedIn.";
    return "";
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(update, DEBOUNCE_MS);
  }

  document.addEventListener("pintapost:change", schedule);
  document.addEventListener("pintapost:settings", update);

  update();

  return { update };
}
