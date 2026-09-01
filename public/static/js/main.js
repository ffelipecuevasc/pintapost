/**
 * PintaPost — punto de entrada de la aplicación.
 *
 * Arranca el tema y el editor, y nada más. La orquestación es deliberadamente
 * fina: quien sabe de formato es `editor/`, quien sabe de Unicode es `format/`,
 * y este archivo solo los presenta al DOM.
 *
 * El contador dual y el botón de copiar llegan en el S05, y se engancharán al
 * evento `pintapost:change` que emite el editor, sin tocar nada de aquí.
 */

"use strict";

import { setupTheme } from "./theme.js";
import { createEditor } from "./editor/editor.js";

/**
 * Monta el editor si su elemento existe. La comprobación no es paranoia
 * gratuita: el mismo `main.js` servirá a la página de política de privacidad
 * (C-06), que no tiene editor.
 */
function setupEditor() {
  const root = document.getElementById("editor");
  if (!root) return;

  const toolbar = document.getElementById("toolbar");
  createEditor(root, { toolbar });
}

setupTheme();
setupEditor();
