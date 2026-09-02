/**
 * PintaPost — punto de entrada de la aplicación.
 *
 * Presenta las piezas al DOM y nada más. Quien sabe de formato es `editor/`,
 * quien sabe de Unicode es `format/`, quien sabe de portapapeles es `export/` y
 * quien sabe de panel lateral es `ui/`. Este archivo solo les pasa los
 * elementos y las tres funciones con las que se hablan entre sí.
 *
 * ── Cómo se comunican, y por qué no se llaman directamente ─────────────────
 *
 * El editor emite `pintapost:change` cuando el modelo cambia y la casilla de
 * compatibilidad emite `pintapost:settings` cuando se marca. Nadie llama al
 * contador: el contador escucha. Así el S04 pudo quedarse cerrado mientras se
 * escribía el S05, y `editor.js` sigue sin saber que existe un panel lateral.
 *
 * En la otra dirección sí hay dependencia, pero en forma de dos funciones que
 * se pasan aquí y que nadie más ve:
 *
 *   getModel()    el modelo de ahora mismo, para serializar
 *   getOptions()  las opciones de serialización, que las guarda `settings`
 *
 * El orden de arranque no es libre: `createSettings` tiene que existir antes
 * que el contador y que el copiado, porque los dos preguntan por `getOptions`.
 */

"use strict";

import { setupTheme } from "./theme.js";
import { createEditor } from "./editor/editor.js";
import { setupCopy } from "./export/clipboard.js";
import { setupCounter } from "./ui/counter.js";
import { createSettings } from "./ui/settings.js";

/**
 * Monta el editor y todo lo que cuelga de él si su elemento existe. La
 * comprobación no es paranoia gratuita: el mismo `main.js` servirá a la página
 * de política de privacidad (C-06), que no tiene editor.
 */
function setupEditor() {
  const root = document.getElementById("editor");
  if (!root) return;

  const editor = createEditor(root, {
    toolbar: document.getElementById("toolbar"),
  });

  const getModel = () => editor.getModel();

  const settings = createSettings({
    getModel,
    checkbox: document.getElementById("compat-toggle"),
    savings: document.getElementById("compat-savings"),
  });

  setupCounter({
    getModel,
    getOptions: settings.getOptions,
    root: document.getElementById("counter"),
    plain: document.getElementById("counter-plain"),
    styled: document.getElementById("counter-styled"),
    hint: document.getElementById("counter-hint"),
    status: document.getElementById("counter-status"),
  });

  setupCopy({
    getModel,
    getOptions: settings.getOptions,
    styled: document.getElementById("copy-styled"),
    plain: document.getElementById("copy-plain"),
    status: document.getElementById("copy-status"),
    manual: document.getElementById("copy-manual"),
    manualField: document.getElementById("copy-manual-field"),
  });
}

setupTheme();
setupEditor();
