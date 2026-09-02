/**
 * PintaPost — la casilla de máxima compatibilidad (S05 tarea 7, ADR-018).
 *
 * El único sitio de la aplicación que lee y escribe la preferencia. `serialize`
 * es pura y recibe las opciones por parámetro; quien las conoce es este
 * archivo, y así el motor de formato no depende de que exista un navegador.
 *
 * ── Qué hace la casilla ────────────────────────────────────────────────────
 *
 * Activada, `serialize` se llama con `styleCombining: false` y las letras con
 * diacrítica —á é í ó ú ñ ü, y cualquier otra latina acentuada— salen sin
 * estilizar mientras el resto del texto sí recibe el formato.
 *
 * Resuelve dos problemas de un tiro, y conviene saber cuál es el que manda:
 *
 * **El motivo real es el renderizado.** En Chrome de escritorio el acento agudo
 * sobre una base matemática se desplaza a la derecha y aterriza sobre la
 * consonante siguiente: `¿Cómo estás?` se lee `¿Coḿo estaś?`. Es el riesgo que
 * ADR-005 dejó aceptado, materializado en uno de los cinco entornos.
 *
 * **El ahorro de caracteres es un efecto secundario.** Una vocal acentuada en
 * negrita cuesta 3 unidades UTF-16 frente a 1 en plano, y dejarla sin estilo
 * devuelve 2 de esas 3. Medido sobre un post real en español, el ahorro es del
 * **3 %**, no del 10-15 % que se estimó al abrir ADR-018: en español solo un
 * 2,7 % de los caracteres llevan diacrítica, y la aritmética no da para más.
 *
 * Por eso el texto de la interfaz **no vende la casilla como una forma de ganar
 * espacio**. Se enseña el ahorro porque es información honesta y en vivo —lo
 * que convierte un ajuste técnico en algo que se entiende—, pero el titular es
 * que las tildes se ven mejor. A un titular de ahorro le faltaría un factor de
 * cuatro.
 *
 * ── Por defecto, desactivada ───────────────────────────────────────────────
 *
 * Según ADR-018: el estilo compuesto sigue siendo el comportamiento normal, y
 * el defecto se revisará cuando se compruebe el renderizado en el feed ya
 * publicado. La preferencia se recuerda en `localStorage` bajo
 * `pintapost:compat`, que es un dato del propio usuario y por tanto uno de los
 * dos usos que ADR-017 permite.
 */

"use strict";

import { serialize } from "../export/serialize.js";
import { characters } from "./format.js";

/** ADR-017: solo preferencias de interfaz del propio usuario. */
const STORAGE_KEY = "pintapost:compat";

/** El mismo retardo que el contador: los dos miden lo mismo, en la misma ráfaga. */
const DEBOUNCE_MS = 150;

/**
 * Lee la preferencia guardada.
 *
 * En `try/catch` porque `localStorage` lanza —no devuelve `null`— cuando el
 * navegador tiene el almacenamiento bloqueado o la página corre en un contexto
 * sin origen. Sin permiso para recordar la elección, la aplicación arranca en
 * el valor por defecto y sigue funcionando entera.
 *
 * @returns {boolean}
 */
function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch (error) {
    return false;
  }
}

function store(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch (error) {
    // Sin almacenamiento la preferencia dura lo que la pestaña. No es motivo
    // para romper nada.
  }
}

/**
 * Arranca la casilla.
 *
 * @param {{
 *   getModel: () => import("../editor/model.js").Model,
 *   checkbox?: HTMLInputElement | null,
 *   savings?: HTMLElement | null,
 * }} options
 * @returns {{ getOptions: () => { styleCombining: boolean } }}
 */
export function createSettings(options) {
  const { getModel } = options;

  const checkbox = options.checkbox ?? null;
  const savingsEl = options.savings ?? null;

  let enabled = readStored();
  let timer = null;

  if (checkbox) checkbox.checked = enabled;

  /** Lo que `serialize` espera. La casilla y la opción van al revés a propósito:
   * "máxima compatibilidad" activada significa "no estilices lo que lleva marca
   * combinable". */
  function getOptions() {
    return { styleCombining: !enabled };
  }

  /**
   * Cuánto se ahorraría —o se está ahorrando— con la casilla activada.
   *
   * Se calcula serializando las dos veces y restando. Es el doble de trabajo
   * que el contador, pero es la única cifra honesta: estimarla contando letras
   * acentuadas daría un número distinto en cuanto la mitad del texto no tenga
   * formato, que es el caso normal.
   */
  function refreshSavings() {
    if (!savingsEl) return;

    const model = getModel();
    const saved =
      serialize(model, { styleCombining: true }).length -
      serialize(model, { styleCombining: false }).length;

    if (saved <= 0) {
      savingsEl.textContent = "";
      savingsEl.hidden = true;
      return;
    }

    savingsEl.textContent = `${
      enabled ? "Ahorras" : "Ahorrarías"
    } ${characters(saved)}.`;
    savingsEl.hidden = false;
  }

  function announce() {
    document.dispatchEvent(
      new CustomEvent("pintapost:settings", { detail: getOptions() }),
    );
  }

  if (checkbox) {
    checkbox.addEventListener("change", () => {
      enabled = checkbox.checked;
      store(enabled);
      refreshSavings();
      // El contador tiene que reflejar el cambio en vivo: activar la casilla
      // baja la cifra UTF-16 sin tocar la de grafemas (ADR-018).
      announce();
    });
  }

  document.addEventListener("pintapost:change", () => {
    clearTimeout(timer);
    timer = setTimeout(refreshSavings, DEBOUNCE_MS);
  });

  refreshSavings();

  return { getOptions };
}
