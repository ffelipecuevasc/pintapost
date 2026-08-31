/**
 * PintaPost — tema claro / oscuro (A-07, ADR-011).
 *
 * Todo el cambio de paleta es un `classList.toggle("dark")` sobre <html>: los
 * colores son variables CSS y no hay una sola variante `dark:` en el marcado.
 *
 * Precedencia: lo que el usuario haya elegido antes gana; si no ha elegido
 * nunca, manda `prefers-color-scheme` y se sigue al sistema si cambia.
 */

"use strict";

const STORAGE_KEY = "pintapost:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const ICON_HREF = "/static/assets/icons.svg";

/** Devuelve "dark" | "light" si hay preferencia guardada válida, o null. */
function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch (error) {
    // Ventana privada o almacenamiento bloqueado: se sigue al sistema.
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    // Sin persistencia, pero el tema sigue funcionando en esta sesión.
  }
}

function systemTheme() {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * Lee el token `--background` ya resuelto ("248 249 255") y lo devuelve como
 * "#f8f9ff", que es el formato que espera <meta name="theme-color">.
 *
 * Se calcula en vez de escribirse a mano para que styles.css siga siendo la
 * única fuente de verdad del color: si cambia la paleta, esto la sigue solo.
 */
function backgroundHex() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  const channels = raw.split(/\s+/);
  if (channels.length !== 3) return null;

  return "#" + channels
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("");
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);

  // Barra del navegador en móvil. Se lee después de alternar la clase, así que
  // getComputedStyle ya devuelve el token del tema nuevo.
  const meta = document.querySelector('meta[name="theme-color"]');
  const hex = backgroundHex();
  if (meta && hex) meta.setAttribute("content", hex);

  const button = document.getElementById("theme-toggle");
  if (button) {
    button.setAttribute(
      "aria-label",
      isDark ? "Activar modo claro" : "Activar modo oscuro",
    );
  }

  // El icono anuncia el tema al que se va, no en el que se está.
  const icon = document.getElementById("theme-toggle-icon");
  if (icon) {
    icon.setAttribute("href", `${ICON_HREF}#${isDark ? "sun" : "moon"}`);
  }
}

export function setupTheme() {
  let theme = readStoredTheme() ?? systemTheme();

  // El script del <head> ya puso la clase; esto sincroniza icono y etiqueta.
  applyTheme(theme);

  const button = document.getElementById("theme-toggle");
  if (button) {
    button.addEventListener("click", () => {
      theme = theme === "dark" ? "light" : "dark";
      storeTheme(theme);
      applyTheme(theme);
    });
  }

  // Mientras el usuario no haya elegido nada, el sistema sigue mandando.
  window.matchMedia(DARK_QUERY).addEventListener("change", (event) => {
    if (readStoredTheme()) return;
    theme = event.matches ? "dark" : "light";
    applyTheme(theme);
  });
}
