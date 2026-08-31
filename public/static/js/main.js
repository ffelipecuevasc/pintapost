/**
 * PintaPost — punto de entrada de la aplicación.
 *
 * De momento solo arranca el tema y el marcador de posición del editor. La
 * lógica de formato y el serializador Unicode llegan en la épica B (S03–S05).
 */

"use strict";

import { setupTheme } from "./theme.js";

/**
 * Marcador de posición del editor (corrige H-12).
 *
 * El atributo `placeholder` no existe para `contenteditable`, así que hay que
 * dibujarlo con CSS. El prototipo lo hacía con `[contenteditable]:empty::before`,
 * que falla en cuanto el usuario escribe y borra: el navegador deja dentro un
 * `<br>` residual, el elemento ya no casa con `:empty` y el marcador no vuelve
 * a aparecer nunca.
 *
 * La solución es alternar una clase comprobando `textContent`, que ignora ese
 * `<br>`. La regla `.is-empty::before` vive en `styles.css` (ADR-015).
 */
function setupPlaceholder() {
  const editor = document.getElementById("editor");
  if (!editor) return;

  const syncPlaceholder = () => {
    editor.classList.toggle("is-empty", editor.textContent.trim() === "");
  };

  // `input` cubre teclado, pegado, cortado y deshacer.
  editor.addEventListener("input", syncPlaceholder);

  // El HTML ya viene con `is-empty` para que no haya destello antes de que
  // corra este script; esta llamada solo re-sincroniza si el navegador ha
  // restaurado contenido al recargar.
  syncPlaceholder();
}

setupTheme();
setupPlaceholder();
