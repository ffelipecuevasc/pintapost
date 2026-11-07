# Auditoría Técnica — PintaPost

Fecha: 29 de agosto de 2026
Alcance auditado: Plan de Proyecto v1 + v2, y el prototipo `index.html`.

Este documento registra los **hallazgos**. Las decisiones que se tomaron a
partir de ellos están en `decisiones.md`, que es lo que Claude Code debe seguir.

---

## Veredicto

**AJUSTES MENORES**, con dos salvedades bloqueantes:

| Alcance | Estado |
|---|---|
| Plan v2 (arquitectura, etapas, motor de formato) | ✅ Sólido |
| Prototipo `index.html` | 🔴 Bloqueo: usa Tailwind Play CDN, no apto para producción |
| Fase 4 (motor de formato) | 🟠 Contradicción de arquitectura sin cerrar |

Ambas quedaron resueltas: ADR-002 y ADR-003.

---

## Hallazgos por severidad

### 🔴 Bloqueantes

**H-01. Tailwind Play CDN en producción.**
`<script src="https://cdn.tailwindcss.com">` compila Tailwind en el navegador:
~400 KB de JS bloqueante, FOUC garantizado, sin purge, sin versión fijada. El
CSS compilado equivalente ronda los 8–12 KB. → **ADR-002**

### 🟠 Mayores

**H-02. Contradicción `contenteditable` vs. modelo de rangos.**
El plan declaraba el modelo como fuente de verdad pero seguía razonando como si
el usuario editara sobre texto ya transformado. Ambas cosas no pueden coexistir.
→ **ADR-003**

**H-03. El contador de caracteres frente al límite de 3.000 de LinkedIn.**
No aparecía en el plan. Un bold es un par subrogado (2 unidades UTF-16); una
vocal acentuada en bold son 3. Un post totalmente en negrita puede alcanzar el
límite a menos de la mitad de su longitud aparente. Fallo invisible para el
usuario. → **ADR-012**

**H-04. El cuello de botella de Gemini es RPM, no RPD.**
Los límites son por proyecto, no por clave. ~15 RPM compartidos entre todos los
visitantes del mundo. 20 usuarios simultáneos ya producen 429s. No es el
escenario de abuso: es el escenario de éxito. → **ADR-008**

**H-05. Turnstile diferido es un riesgo mal calculado.**
Sin cuentas no hay a quién banear ni cómo recuperarse. Un script puede matar la
función para todos en 60 segundos. Turnstile invisible es gratis y sin fricción.
→ **ADR-007**

### 🟡 Errores concretos en el anexo técnico del plan

**H-06. Inconsistencia serif/sans-serif.** La tabla declaraba `U+1D41A` (𝐚,
serif) pero mostraba 𝗮 (sans-serif). → **ADR-004**

**H-07. Hueco en la cursiva serif.** `U+1D455` está reservado: la `h` minúscula
en *Mathematical Italic* no existe (Unicode ya tenía ℎ en `U+210E`). La fórmula
de desplazamiento produciría un carácter no asignado en *hola*, *hacer*,
*ahora*. Los bloques sans-serif no tienen esta excepción. → **ADR-004**

**H-08. No existen dígitos en cursiva** en ninguna variante de Unicode. Los bold
sí. → **ADR-005**

**H-09. Lista de casos sin mapeo incompleta.** Faltaban `ü/Ü` (trivial de
añadir, aparece en *pingüino*, *vergüenza*) y `º ª « » €`. → **ADR-005**

### 🟡 Riesgos de producto no documentados

**H-10.** El buscador de LinkedIn no indexa texto Unicode matemático. Poner la
palabra clave principal en negrita le cuesta alcance real al usuario.

**H-11.** Los hashtags y menciones en Unicode dejan de funcionar como enlaces.
→ **ADR-013** (y es un diferenciador: nadie del mercado lo resuelve bien)

### 🟡 Bugs ya presentes en el prototipo

**H-12. El placeholder se rompe.** La regla `[contenteditable]:empty:before`
falla cuando el usuario escribe y borra: el navegador deja un `<br>` residual y
el elemento ya no es `:empty`. Solución: alternar una clase desde JS.

**H-13. Falta semántica accesible.** El editor necesita `role="textbox"`,
`aria-multiline`, `aria-label`, `lang="es"`. La barra necesita `role="toolbar"`
y `aria-pressed` en los botones de estilo.

**H-14. Modo oscuro declarado pero inexistente.** `darkMode: "class"` está
configurado sin un solo token oscuro. → **ADR-011**

**H-15. Material Symbols contradice el plan**, está duplicado en el `<head>`, y
durante la carga muestra el texto literal `format_bold`, `content_copy` en la
interfaz. → **ADR-010**

**H-16. Navegación fantasma.** Nueve elementos de interfaz describen funciones
inexistentes, incluido "Upgrade Plan" en un producto gratuito. → **ADR-009**

### 🟡 Detalles de implementación críticos

**H-17. Portapapeles en Safari iOS.** Si haces `await` de algo antes de
`navigator.clipboard.write()`, se pierde el contexto del gesto y la escritura
falla en silencio. Con serialización síncrona no ocurre; si alguna vez se
vuelve asíncrona, hay que pasar una Promise a `ClipboardItem` en lugar de
esperar antes.

**H-18. Workers no excluye `node_modules` automáticamente** como hacía Pages.
Hace falta `.assetsignore`. → **ADR-001**

**H-19. Workers no soporta bindings distintos por rama.** El secreto de Gemini
sería el mismo en preview y producción. → backlog X-08

**H-20. Privacidad.** El free tier de Gemini puede usar los prompts para
entrenar. Con un tema de lista cerrada el riesgo es nulo; deja de serlo si
alguna vez se implementa "Mejorar con IA". → backlog X-02

---

## Confirmaciones (cosas que el plan ya hacía bien)

- El cambio de Pages a Workers + Static Assets es correcto y está alineado con
  la dirección declarada de Cloudflare.
- Vanilla JS es la elección adecuada: un framework añadiría reactividad
  innecesaria para una sola vista y complicaría el manejo de `Selection`/`Range`.
- La técnica de marcas combinables para tildes es la única solución posible y ya
  se usa en producción por otras herramientas de LinkedIn.
- Dividir en dos etapas permite lanzar algo útil mucho antes.
- AI Gateway desde el día uno es la mitigación de mayor impacto para la cuota.
- Descartar Workers KV para rate limiting es correcto.

## Alternativas evaluadas y descartadas

| Alternativa | Motivo del descarte |
|---|---|
| Framework (Svelte/Preact/Lit) | Complejidad sin beneficio para una vista única |
| Deno Deploy / Netlify | No tienen equivalente a AI Gateway |
| Workers AI en lugar de Gemini | Calidad inferior en redacción en español; queda como *fallback* |
