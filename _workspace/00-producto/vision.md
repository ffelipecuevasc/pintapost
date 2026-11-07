# Visión de Producto — PintaPost

## Frase de posicionamiento

> Para profesionales que publican en LinkedIn y quieren que su contenido
> destaque visualmente, **PintaPost** es un editor web gratuito que aplica
> negritas, cursivas y listas que **sobreviven al pegar**, porque convierte el
> texto a caracteres Unicode en lugar de depender de un formato que LinkedIn
> descarta. A diferencia de AuthoredUp o Taplio, no requiere cuenta, no cuesta
> nada y no guarda tu contenido en ningún servidor.

El nombre viene de la expresión "tirar pinta" (verse bien, con estilo): PintaPost
hace que tus publicaciones de LinkedIn *tiren pinta*.

## Problema

El editor de LinkedIn no ofrece formato de texto enriquecido. Si redactas en
Word, Google Docs o Notion y pegas, el formato se pierde por completo. El texto
queda como un bloque plano donde nada destaca, y el lector abandona antes del
corte de "…ver más".

## Solución

Un editor que mantiene internamente el texto y sus estilos como datos, y al
copiar los transforma a caracteres Unicode de los bloques *Mathematical
Alphanumeric Symbols*, que LinkedIn preserva porque, técnicamente, son letras
normales para él.

## Usuario objetivo

**Perfil primario:** profesional hispanohablante que publica en LinkedIn entre
una y varias veces por semana. Consultores, reclutadores, desarrolladores,
personas construyendo marca personal. No es técnico. Escribe en español, con
tildes y eñes.

**Necesidad emocional:** quiere verse profesional sin parecer que usa trucos, y
sin pagar una suscripción mensual por un formateador de texto.

## Principios de producto

1. **Cero fricción.** Sin registro, sin correo, sin cookies de consentimiento.
   Se abre la página y se escribe.
2. **Cero servidor para lo esencial.** El formato funciona íntegramente en el
   navegador. Si la IA cae, el producto sigue siendo útil.
3. **Honestidad sobre los costes.** El texto Unicode tiene desventajas reales
   (lectores de pantalla, búsqueda de LinkedIn). El producto las comunica en
   vez de ocultarlas.
4. **Español de primera clase.** Tildes, ñ, ü, ¿ y ¡ funcionan correctamente.
   Casi ninguna herramienta del mercado lo resuelve bien.
5. **Coste operativo $0.** Todo dentro de los tiers gratuitos de GitHub,
   Cloudflare y Google.

## Qué NO es PintaPost

Delimitar esto evita que el alcance se desborde:

- ❌ No programa publicaciones ni publica en LinkedIn (requeriría OAuth y la API
  de LinkedIn, que no es gratuita ni abierta).
- ❌ No tiene cuentas de usuario, ni analítica de posts, ni biblioteca en la nube.
- ❌ No es un CRM ni una herramienta de crecimiento.
- ❌ No es un plan de pago disfrazado: no habrá "Upgrade".
- ❌ No almacena el contenido del usuario en ningún servidor. Los borradores
  viven en `localStorage`, en su navegador.

## Métricas de éxito del MVP (Etapa 1)

| Métrica | Objetivo |
|---|---|
| Texto pegado en LinkedIn conserva el formato | 100 % en Chrome, Edge, Safari desktop, Safari iOS y Chrome Android |
| Palabras con tilde y ñ se renderizan correctamente en LinkedIn | 100 % en los 5 entornos anteriores |
| Peso total de la página (HTML+CSS+JS+fuentes) | < 120 KB comprimido |
| Largest Contentful Paint en 4G simulado | < 1,5 s |
| Coste mensual de infraestructura | 0 USD |
| Puntuación de accesibilidad de la interfaz (Lighthouse) | ≥ 95 |

## Alcance por etapas

**Etapa 1 — MVP sin IA.** Editor, formato, copiado, borradores, modo oscuro,
vista previa de LinkedIn. Producto completo y publicable por sí solo.

**Etapa 2 — Capa de IA.** Generador de ideas por tema y tono, vía Worker →
Cloudflare AI Gateway → Gemini. Se añade sobre un producto ya lanzado.

## Ideas explícitamente aplazadas

No entran en Etapas 1 ni 2, pero quedan registradas para no perderlas:
generador de ganchos, reescritura y expansión de texto con IA, comandos slash,
selector de emojis completo, plantillas de post, exportación a imagen.
