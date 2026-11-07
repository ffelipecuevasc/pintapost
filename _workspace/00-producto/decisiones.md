# Decisiones de Arquitectura (ADR)

Registro de decisiones cerradas. **No revertir ninguna sin añadir una nueva
entrada que la sustituya explícitamente.** Claude Code debe leer este archivo
al inicio de cada sprint.

Estados: ✅ Aceptada · ⏸️ Propuesta · ❌ Sustituida · ✅ (parcial) Vigente salvo
en lo que otra ADR posterior sustituya explícitamente

---

## ADR-001 — Cloudflare Workers + Static Assets, no Pages ✅ (parcial)

> ⚠️ **Parcialmente sustituida por ADR-016.** El directorio de assets ya no es
> la raíz del repositorio sino `public/`, y `.assetsignore` pasa a vivir dentro
> de él reducido a una línea. Todo lo demás de esta ADR sigue vigente.

**Contexto.** El plan original especificaba Cloudflare Pages + Pages Functions.

**Decisión.** Desplegar sobre Workers con Static Assets, con la lógica de la
Etapa 2 en el mismo Worker.

**Motivo.** Desde marzo de 2026 Workers tiene paridad completa con Pages en
assets estáticos, SSR y dominios personalizados. Cloudflare recomienda Workers
para proyectos nuevos y ha declarado que toda su inversión y trabajo de features
va a Workers; Pages está en modo mantenimiento. Además Workers da `wrangler tail`
para logs en tiempo real, lo que en la Etapa 2 marca la diferencia entre
depurar un 500 en diez minutos o en tres horas.

**Consecuencias.**
- Hay que crear `.assetsignore` manualmente (Workers no excluye `node_modules`
  ni `.git` automáticamente, Pages sí lo hacía). ~~Vive en la raíz y excluye
  todo lo no publicable.~~ → **ADR-016**: vive en `public/.assetsignore` y solo
  excluye `static/css/styles.css`; el resto queda fuera de `public/` y por
  tanto nunca se publica.
- Workers no soporta bindings distintos por rama. Para staging haremos un
  Worker separado con su propio proyecto de Google Cloud.
- `run_worker_first` debe limitarse a `/api/*` para que servir el HTML no
  consuma invocaciones.

---

## ADR-002 — Tailwind compilado con CLI, nunca el Play CDN ✅

**Contexto.** El prototipo `index.html` carga `https://cdn.tailwindcss.com`.

**Decisión.** Build local con `tailwindcss` CLI, salida a `dist/styles.css`
minificada. Prohibido el Play CDN en cualquier entorno, incluido desarrollo.

**Motivo.** El Play CDN compila Tailwind en el navegador: ~400 KB de JS
bloqueante, FOUC garantizado, sin purge, y sin fijación de versión (un cambio
publicado por Tailwind altera el sitio sin que hagamos deploy). El CSS
compilado para esta app ronda los 8–12 KB.

**Consecuencias.** El proyecto necesita `package.json` y `node_modules` en
desarrollo. Esto no viola la restricción de "sin dependencias": la restricción
aplica al runtime, no al tooling.

---

## ADR-003 — Modelo primero: el editor nunca contiene Unicode matemático ✅

**Decisión más importante del proyecto.**

**Contexto.** El plan v2 declaraba `{texto + rangos}` como fuente de verdad,
pero el anexo seguía asumiendo que el usuario edita sobre texto ya transformado
(de ahí la preocupación por `Intl.Segmenter`, cursor y backspace). Las dos ideas
son incompatibles.

**Decisión.**

```
Editor       → texto latino normal, negrita mostrada con CSS (font-weight)
Modelo       → { text: "Hola mundo", ranges: [{start:0, end:4, style:'bold'}] }
Serializador → se ejecuta SOLO al pulsar "Copiar". Su salida nunca vuelve al editor.
```

**Motivo.** Elimina de un golpe: el cursor sobre grafemas de 3 unidades UTF-16,
el backspace que parte letras acentuadas, la necesidad de `Intl.Segmenter` en la
selección, y el problema de accesibilidad *dentro* del editor. Convierte
"Copiar como texto plano" y "Limpiar formato" en operaciones triviales, porque
el modelo original nunca se destruyó.

**Consecuencias.**
- `Intl.Segmenter` sigue siendo necesario, pero solo en el contador de
  caracteres sobre la cadena serializada.
- Con `contenteditable`, aplicar patrón *model → render*: leer el DOM, normalizar
  a `{text, ranges}`, re-renderizar a `<strong>`/`<em>`, y restaurar el cursor
  usando offsets sobre el texto plano (estables), no sobre nodos del DOM.

---

## ADR-004 — Bloques Sans-Serif, no Serif ✅

**Decisión.** Usar *Mathematical Sans-Serif* para todos los estilos:

| Estilo | Mayúsculas | Minúsculas |
|---|---|---|
| Bold | `U+1D5D4` 𝗔 | `U+1D5EE` 𝗮 |
| Italic | `U+1D608` 𝘈 | `U+1D622` 𝘢 |
| Bold Italic | `U+1D63C` 𝘼 | `U+1D656` 𝙖 |
| Dígitos bold | `U+1D7EC` 𝟬 | — |

**Motivo.**
1. LinkedIn renderiza en una fuente sans. El bold serif se ve como un cuerpo
   extraño incrustado; el sans-serif se integra.
2. **Los bloques sans-serif no tienen huecos.** El bloque *Mathematical Italic*
   serif carece de la `h` minúscula: `U+1D455` está reservado porque Unicode ya
   tenía la constante de Planck en `U+210E`. Implementar cursiva serif por
   fórmula produce un carácter no asignado en palabras como *hola*, *hacer*,
   *ahora*. Con sans-serif la fórmula es segura sin excepciones.

**Consecuencia.** El anexo del plan v1/v2 contenía una inconsistencia
(declaraba `U+1D41A` pero mostraba 𝗮). Queda corregida por esta ADR.

---

## ADR-005 — Vocales acentuadas por composición de dos codepoints ✅

**Decisión.** Para `á é í ó ú ñ ü` (y mayúsculas), componer la letra base en su
versión matemática + una marca diacrítica combinable:

| Carácter | Base | Marca |
|---|---|---|
| á é í ó ú | letra sans-serif correspondiente | `U+0301` acento agudo |
| ñ | `n` sans-serif | `U+0303` virgulilla |
| ü | `u` sans-serif | `U+0308` diéresis |

**Motivo.** El bloque matemático no define ninguna letra con tilde, y nunca lo
hará. Componer grafemas es el mecanismo estándar, ya usado en producción por
otras herramientas de LinkedIn para tachado y subrayado.

**Riesgo aceptado.** La posición vertical de la marca depende de las tablas de
*mark positioning* de la fuente, afinadas para latín normal. En Android/Noto
antiguos la tilde puede verse ligeramente desalineada. Debe validarse
empíricamente antes de cerrar el sprint S03.

**Casos sin solución.** `¿ ¡ º ª « » €` y guiones largos no tienen letra base.
Política: **cualquier carácter sin mapeo pasa sin transformar.**

**Sin solución para cursiva.** Unicode no define dígitos itálicos en ninguna
variante. Cursiva sobre un número → el número se deja intacto.

---

## ADR-006 — Dos etapas: MVP sin IA primero ✅

**Decisión.** Lanzar públicamente la Etapa 1 (editor completo, sin IA) antes de
tocar Gemini.

**Motivo.** El motor de formato es el producto; la IA es un extra. Separarlos
permite lanzar algo útil y de riesgo cero mucho antes, y valida la hipótesis
central (¿el formato sobrevive al pegado?) sin depender de una API externa.

---

## ADR-007 — Turnstile activo desde el lanzamiento de la Etapa 2 ✅

**Contexto.** El plan v2 lo dejaba "preparado pero no obligatorio".

**Decisión.** Activar Turnstile en modo invisible/managed desde el día uno de la
Etapa 2.

**Motivo.** El free tier de Gemini ronda las 15 peticiones por minuto **a nivel
de proyecto**, compartidas entre todos los visitantes del mundo. Un solo script
puede dejar la función inservible para todos en 60 segundos, y sin cuentas no
hay a quién banear ni forma de recuperarse. Turnstile invisible tiene fricción
prácticamente nula para un usuario real y es gratuito.

**Consecuencia.** El rate limiting de AI Gateway se mantiene como capa
complementaria, no sustituta: no detiene un ataque distribuido.

---

## ADR-008 — Gemini Flash-Lite + AI Gateway con caché de variantes ✅

**Decisión.**
- Modelo: **Flash-Lite**, no Flash (el doble de RPM y calidad suficiente para
  generar la idea de un post).
- AI Gateway con caché agresiva delante de Gemini.
- Pre-generar **5 variantes por combinación tema+tono** con URLs de caché
  distintas; el Worker elige una al azar.
- Cadena de degradación: Gemini → (429) → Workers AI → (fallo) → banco estático
  de ideas pre-generadas servido como asset JSON.

**Motivo.** El cuello de botella real es RPM, no RPD. Con ~6 temas × 4 tonos ×
5 variantes = 120 entradas cacheadas, la mayoría del tráfico no llega a Gemini,
y el usuario percibe variedad en lugar de recibir todos la misma idea.

---

## ADR-009 — Sin cuentas de usuario: eliminar la navegación fantasma ✅

**Decisión.** Retirar del prototipo: nav `Dashboard/Analytics/Settings`, iconos
de notificaciones y cuenta, botón "New Post", sidebar
`Templates/Library/Schedule`, "Upgrade Plan" / "Creator Pro", y la bottom nav
móvil de tres secciones.

**Motivo.** Describen un producto que no existe. "Upgrade Plan" en particular es
engañoso: el proyecto es gratuito y no tendrá plan de pago.

**Sustitución.** El sidebar pasa a ser un panel de utilidades reales:
borradores en `localStorage`, contador dual de caracteres, vista previa de
LinkedIn con el corte de "…ver más", toggle claro/oscuro y enlace a privacidad.
En móvil se convierte en un *bottom sheet* colapsable.

---

## ADR-010 — Iconos SVG inline y fuentes auto-hospedadas ✅

**Decisión.** Sustituir Material Symbols por un sprite SVG inline (~10 iconos,
unos 2 KB). Auto-hospedar Inter subsetteada a `latin` + `latin-ext`, con
`font-display: swap`.

**Motivo.** (1) El plan ya especificaba SVGs estáticos; el prototipo lo
contradecía y además duplicaba el `<link>`. (2) Con la fuente de iconos, durante
la carga se ve el texto literal `format_bold`, `content_copy` en la interfaz.
(3) Google Fonts implica transferencia de IP a Google, lo que en la UE obligaría
a mencionarlo en la política de privacidad.

---

## ADR-011 — Tokens de color como CSS custom properties ✅

**Decisión.** Definir la paleta en `:root` y `.dark` como variables CSS, y que
Tailwind las referencie con `rgb(var(--primary) / <alpha-value>)`.

**Motivo.** El prototipo tiene ~50 colores hardcodeados y `darkMode: "class"`
declarado sin ningún token oscuro. Sin este refactor, el modo oscuro exigiría
duplicar cada color como variante `dark:`. Con él, el toggle es un
`classList.toggle('dark')`.

---

## ADR-012 — Contador dual de caracteres ✅

**Decisión.** Mostrar simultáneamente la longitud del texto plano y la longitud
de la cadena serializada, y advertir sobre el límite de 3.000 de LinkedIn con el
peor caso de los dos.

**Motivo.** Un carácter matemático bold es un par subrogado (2 unidades UTF-16);
una vocal acentuada en bold son 3. Si LinkedIn cuenta por unidades UTF-16 —lo
habitual—, un post totalmente en negrita alcanza el límite a menos de la mitad
de su longitud aparente. Sin contador, el usuario sufre un truncado sin
diagnóstico posible.

**Resultado empírico (2026-08-31).** LinkedIn cuenta **unidades UTF-16**. Queda
cerrado lo que esta ADR tenía pendiente desde su redacción.

Medido con los fixtures de la tarea 6 del S03, `contador-B-negrita.txt` y
`contador-C-acentos.txt`. Los dos superan el límite a propósito, y el exceso que
reportó LinkedIn coincidió con la predicción por UTF-16 en ambos:

| Fixture | Total previsto | Exceso reportado | Si contara codepoints | Si contara grafemas |
|---|---|---|---|---|
| B — negrita | 4.009 | **1.009** | sin exceso | sin exceso |
| C — vocales acentuadas en negrita | 6.009 | **3.009** | 1.008 | sin exceso |

El fixture C es el que decide: sus tres medidas se separan (6.008 UTF-16 /
4.008 codepoints / 2.008 grafemas), así que un exceso de 3.009 solo es
compatible con UTF-16. Por codepoints habría dicho 1.008, y por grafemas no
habría avisado en absoluto.

> Nota para quien repita el experimento: `count()` sobre los archivos devuelve
> 4.008 y 6.008, una unidad menos que los totales de arriba. El desfase es de
> +1 exacto en los dos casos, así que no afecta a la conclusión —ninguna
> hipótesis alternativa queda a una unidad de distancia—, pero conviene no
> perseguirlo como si fuera un error de aritmética: es constante y del lado de
> LinkedIn.

**Lo que esto le cuesta al usuario.** El límite de 3.000 deja de ser una cifra
de caracteres y pasa a ser un presupuesto que cada estilo gasta a distinto
ritmo:

| Contenido | Unidades UTF-16 por carácter | Límite real |
|---|---|---|
| Texto plano | 1 | 3.000 |
| Negrita o cursiva | 2 | 1.500 |
| Vocal acentuada en negrita | 3 | 1.000 |
| Vocal acentuada en negrita y subrayada | 4 | 750 |

Los casos extremos son extremos: nadie publica 3.000 caracteres íntegros en
negrita. En un post en español realista, con alrededor de un 20 % del texto
resaltado, el ratio entre unidades UTF-16 y caracteres percibidos es de
**1,18**. La pérdida es modesta en el caso normal y brutal en el peor, que es
justo la forma de riesgo que un contador tiene que cubrir.

**LinkedIn no trunca al pegar.** Avisa del exceso y bloquea la publicación. Eso
corrige el diagnóstico del apartado «Motivo»: el daño no es un truncado
silencioso, sino llegar al final de la redacción y encontrarse con que el post
no se puede publicar sin recortarlo. Menos grave, pero igual de frustrante, y se
evita con la misma solución.

**Consecuencia para el S05.** El contador dual se confirma como imprescindible,
con dos requisitos que antes no estaban fijados:

1. La cifra **UTF-16 es la principal**, la que se muestra destacada y contra la
   que se compara el límite de 3.000. La longitud en caracteres percibidos
   acompaña como referencia, no al revés.
2. El aviso llega **antes** de alcanzar el límite, no al cruzarlo. Avisar en
   3.001 es informar de un problema cuando ya no tiene arreglo barato.

**Actualización (2026-09-01) — confirmado sobre el producto terminado.** El
contador dual del S05 está implementado y se comprobó contra el de LinkedIn
escribiendo hasta que PintaPost marcó 3.000: las dos cifras coincidieron. La
medida de agosto se hizo con fixtures aislados; esta cierra el circuito completo
—modelo, serialización y contador— y confirma los dos requisitos de arriba tal y
como se implementaron.

Un matiz que salió al escribir la interfaz: el apartado «LinkedIn no trunca al
pegar» de esta ADR corrige el diagnóstico, y el mensaje de error del contador
tuvo que corregirse con él. Decía «LinkedIn cortará el final del texto», que es
justamente lo que esta ADR descubrió que **no** pasa. Ahora dice que no dejará
publicar hasta recortar, que es lo que el usuario se va a encontrar.

---

## ADR-013 — Hashtags y menciones nunca reciben formato ✅

**Decisión.** El motor detecta `#palabra` y `@nombre` y se niega a aplicarles
estilo, con un tooltip que explica por qué.

**Motivo.** `#𝗠𝗮𝗿𝗸𝗲𝘁𝗶𝗻𝗴` no se convierte en enlace ni agrupa en LinkedIn, y las
menciones dejan de funcionar. Además el buscador de LinkedIn no indexa texto
Unicode matemático: poner la palabra clave principal en negrita le cuesta
alcance real al usuario. Ninguna herramienta del mercado resuelve esto bien;
es un diferenciador.

---

## ADR-014 — `_workspace/` fuera de Git, con repo anidado ✅

**Decisión.** La carpeta de planificación se ignora en el repo público y tiene
su propio `git init` anidado.

**Motivo.** Se mantiene privada, pero con historial y backup local. Si en el
futuro se quiere respaldo remoto, un repositorio privado en GitHub sin tocar el
público.

---

## ADR-015 — Todo el CSS vive en `styles.css`: cero estilos inline en el HTML ✅

**Contexto.** El prototipo `index.html` mezcla tres formas de aplicar estilo:
utilidades de Tailwind en `class`, un bloque `<style>` en el `<head>`
(`.material-symbols-outlined`, `.icon-fill`, `[contenteditable]:empty:before`) y
atributos `style=` inline (el mismo `box-shadow` repetido en dos `<section>`).
Las reglas del `<head>` y del `style=` no pasan por el pipeline de Tailwind, no
se minifican, no se cachean aparte del HTML y duplican responsabilidades con
`static/css/styles.css`.

**Decisión.** El HTML solo lleva clases. Todo el CSS del proyecto —el propio y
el generado por Tailwind— se declara en `static/css/styles.css` y se sirve
compilado desde `static/css/tailwind.css`. Queda prohibido en cualquier archivo
`.html`:

- La etiqueta `<style>`, en el `<head>` o en el `<body>`.
- El atributo `style=` inline en cualquier elemento.
- Cualquier `<link rel="stylesheet">` que no sea el de `tailwind.css`.

Lo que no encaje en una utilidad de Tailwind se escribe como componente o
utilidad en `styles.css` (con `@apply` cuando se pueda, CSS plano cuando no),
nunca en el marcado.

**Motivo.**
1. Una sola fuente de verdad para el estilo: revisar, versionar y auditar el CSS
   en un archivo, no repartido por atributos del marcado.
2. Los estilos inline no se pueden purgar, minificar ni cachear por separado, y
   ganan por especificidad a casi todo, lo que vuelve frágiles el tema oscuro y
   los estados de foco.
3. Un `style=` con color o sombra hardcodeada se salta los tokens de ADR-011 y
   reaparece roto en modo oscuro: es exactamente lo que ocurría con el
   `box-shadow` inline del prototipo.
4. `<style>` en el `<head>` bloquea el render igual que el inline y además queda
   fuera de todo control de versión y de minificación del CSS.

**Consecuencias.**
- `styles.css` incorpora `.card` para el patrón de tarjeta con sombra por token
  (`var(--shadow-card)`), en sustitución del `box-shadow` inline. Se aplica en
  **S01**.
- El bloque `<style>` del `<head>` se elimina entero en **S02**: sus dos reglas
  de iconos desaparecen junto con Material Symbols (ADR-010) y el placeholder
  pasa a la clase `.is-empty`, ya definida en `styles.css` (H-12).
- Excepción acotada: el script mínimo de tema del `<head>` (S02) puede escribir
  `document.documentElement.style` / `classList` desde JS para evitar el destello
  en modo oscuro. Es una asignación puntual en runtime, no estilo declarado en
  el marcado, y no contradice esta ADR.
- No cambia nada respecto a las utilidades de Tailwind en `class`: son el
  mecanismo previsto y siguen siendo la primera opción.

---

## ADR-016 — Directorio de assets dedicado (`public/`) ✅

**Contexto.** La ADR-001 fijó Workers + Static Assets y, con ella,
`wrangler.jsonc` declaraba `"assets": { "directory": "./" }`: el directorio de
assets era la raíz del repositorio. Todo lo que no debía publicarse se excluía
a mano en `.assetsignore` (`node_modules`, `.git`, `package.json`,
`wrangler.jsonc`, `CLAUDE.md`, `_workspace`, `worker`, `tests`…). En el S01
(tarea 9) esa disposición resultó además ser inservible en desarrollo.

**Decisión.** Los assets publicables viven en `public/`:

```
public/
├── .assetsignore
├── index.html
└── static/
    ├── css/{styles.css, tailwind.css}
    ├── js/main.js
    └── assets/
```

`wrangler.jsonc` declara `"directory": "./public"`. `.assetsignore` se mueve
dentro de `public/` —sus rutas son relativas al directorio de assets— y queda
reducido a una sola línea: `static/css/styles.css`.

**Motivo.**

1. **Publicar desde la raíz es una lista negra que falla en abierto.** Con
   `directory: "./"`, un archivo nuevo que nadie se acuerde de añadir a
   `.assetsignore` se publica solo. El fallo es silencioso y del lado
   equivocado: un `.env.example`, unas notas, un volcado de depuración quedan
   servidos en producción sin que nada avise. `public/` invierte la lógica a
   lista blanca: lo que no se mueve ahí dentro no se publica, y el descuido
   deja de tener consecuencias.
2. **`wrangler dev` entraba en bucle de recarga.** Wrangler vigila el
   directorio de assets y a la vez escribe su propio estado dentro de él
   (`.wrangler/state/**/metadata.sqlite-shm`, `.wrangler/tmp/dev-*`). Escribe →
   detecta cambio → recarga → vuelve a escribir. Medido el 2026-08-30: 53
   recargas en 2 minutos y todas las peticiones a código 000. `.assetsignore`
   no lo evita porque controla **qué se publica, no qué se vigila**. Con el
   directorio de assets en `public/`, `.wrangler/` queda fuera de lo vigilado y
   el bucle desaparece por construcción, sin rutas externas al proyecto ni
   flags en los scripts.

**Consecuencias.**
- `index.html` no cambia: sus rutas son absolutas (`/static/...`) y siguen
  resolviendo igual, porque `public/` es la raíz del sitio servido.
- `package.json`: `build:css`, `watch:css` y `clean` apuntan a
  `./public/static/css/`.
- `tailwind.config.js`: `content: ["./public/**/*.{html,js}"]`.
- `.gitignore` ignora `public/static/css/tailwind.css`.
- Cambia la «Estructura objetivo» declarada en el S01, que se actualiza.
- Verificado el 2026-08-30 tras el cambio: 0 recargas en 60 s; `/` 200,
  `/static/css/tailwind.css` 200 (23.011 b, `text/css`), `/static/js/main.js`
  200; `/static/css/styles.css`, `/package.json`, `/wrangler.jsonc` y
  `/CLAUDE.md` devuelven 404.

**Sustituye parcialmente a ADR-001**, solo en lo relativo al directorio de
assets y al papel de `.assetsignore`. El resto de la ADR-001 —Workers en lugar
de Pages, Worker único para la Etapa 2, `run_worker_first` limitado a `/api/*`—
sigue vigente.

---

## ADR-017 — `localStorage` acotado a datos del propio usuario ✅

**Contexto.** `CLAUDE.md` decía «Nunca uses `localStorage` para nada que no sean
borradores del usuario». La tarea 8 del S02 exigía leer y escribir
`pintapost:theme` para que el tema elegido sobreviva a la recarga, que es
literalmente lo que pide la historia A-07 («y que se recuerde mi elección»).
Las dos reglas eran incompatibles y el conflicto se detectó al implementar el
modo oscuro.

**Decisión.** `localStorage` queda permitido para **datos del propio usuario**:

- Borradores de sus publicaciones.
- Preferencias de interfaz. Hoy solo el tema (`pintapost:theme`).

Sigue **prohibido** para todo lo demás, en particular:

- Caché de cualquier tipo.
- Estado de la aplicación.
- Cualquier dato que deba vivir en el modelo `{ text, ranges }` de ADR-003.

**Motivo.** La regla original perseguía algo correcto —que el estado no se
disperse fuera del modelo y que no aparezca una caché opaca imposible de
depurar— pero se redactó demasiado estrecha. Una preferencia de interfaz no es
estado de aplicación: no participa en ninguna transformación, no afecta al
contenido y su pérdida no rompe nada, solo devuelve al usuario al valor del
sistema. Guardarla es exactamente el caso de uso para el que existe
`localStorage`.

La alternativa era no persistir y seguir siempre `prefers-color-scheme`, lo que
haría imposible que un usuario prefiera un tema distinto al de su sistema
operativo y dejaría A-07 sin cumplir.

**Consecuencias.**
- Se actualiza la línea correspondiente de `CLAUDE.md`.
- Toda escritura y lectura va envuelta en `try/catch`: en ventana privada o con
  el almacenamiento bloqueado la aplicación sigue funcionando y simplemente no
  persiste. Ya implementado en `theme.js`.
- Las claves se prefijan con `pintapost:` para no colisionar con nada.
- Cualquier clave nueva que no sea un borrador ni una preferencia de interfaz
  necesita una ADR que la justifique.

---

## ADR-018 — Opción de máxima compatibilidad para caracteres con marca combinable ✅

**Contexto.** Dos hallazgos independientes del S03 apuntan al mismo sitio: las
letras que se construyen componiendo una base matemática con una marca
combinable (ADR-005) son a la vez las que peor se renderizan y las que más caro
salen.

**Decisión.** `toStyled` acepta una opción `styleCombining` en el objeto de
estilo, con valor **`true` por defecto**. Con `false`, cualquier carácter que
tras `NFD` requiera una o más marcas combinables se deja **sin transformar**; el
resto del texto sí recibe el estilo.

El subrayado y el tachado se siguen aplicando en los dos modos: son marcas de
estilo que este motor añade, no diacríticas del idioma que el usuario escribió.

**Motivo.** Dos problemas independientes con una sola solución.

**(a) Renderizado.** En Chrome de escritorio el acento agudo sobre una base
matemática se desplaza a la derecha y aterriza sobre la consonante siguiente:
`¿Cómo estás?` se lee `¿Coḿo estaś?`. La virgulilla (ñ) y la diéresis (ü) se
posicionan bien, y los otros cuatro entornos están limpios. Es el riesgo que
ADR-005 dejó aceptado, materializado en uno de cinco. El detalle completo, en
`_workspace/90-manual/verificacion-cross-device.md`.

**(b) Presupuesto de caracteres.** Una vocal acentuada en negrita cuesta 3
unidades UTF-16 frente a 1 en texto plano, y LinkedIn cuenta por UTF-16
(ADR-012). Dejarla sin estilo devuelve 2 de esas 3 unidades.

**La regla es deliberadamente amplia.** Incluye `ñ` y `ü` aunque se rendericen
bien en los cinco entornos, y también las diacríticas ajenas (`à ê ï õ ç`). Una
regla que cabe en una frase —«si lleva algo encima, no se toca»— se recuerda y
se explica al usuario; una lista de excepciones por marca concreta no la
recordará nadie dentro de seis meses, y habría que revisarla cada vez que
cambie el renderizado de un navegador.

**Por defecto queda activo el estilo compuesto (opción A).** La casilla que
expone la alternativa en la interfaz es del **S05**, junto al contador. El
defecto se revisará cuando se compruebe el renderizado **en el feed publicado**,
que es la comprobación que queda abierta en la tarea 5.

**Consecuencias.**
- Implementado en `unicode.js` (S03, tarea 8), con nueve tests propios.
  `stripStyling` no necesita cambios: lo que la opción produce es texto que ya
  sabía limpiar.
- Round-trip e idempotencia se mantienen con la opción desactivada, verificados
  sobre el corpus completo en las nueve combinaciones de estilo.
- La salida en modo `false` conserva la letra **precompuesta** tal y como llegó
  (`ó` = U+00F3, 1 unidad UTF-16) en lugar de descomponerla. Emitirla en NFD
  costaría 2 unidades y se comería la mitad del ahorro del motivo (b).
- El contador dual del S05 tendrá que reflejar el cambio en vivo: activar la
  casilla baja la cifra UTF-16 sin cambiar la de grafemas.

**Medición del ahorro.** El motivo (b) se estimó al abrir esta ADR en un 10-15 %
del presupuesto de caracteres. **Medido, es del 3 %**, y conviene dejarlo
escrito para no volver a apoyarse en la cifra optimista:

| Texto | Unidades UTF-16 |
|---|---|
| Post en español de 889 caracteres, plano | 889 |
| Todo en negrita, `styleCombining: true` | 1.623 |
| Todo en negrita, `styleCombining: false` | 1.575 |

El ahorro son 48 unidades, un **3,0 %**. La aritmética explica por qué no puede
ser más: se ahorran exactamente 2 unidades por letra acentuada, y en español
solo un **2,7 %** de los caracteres llevan diacrítica. Para llegar al 10 % haría
falta que la llevara uno de cada diez. En un post con solo un 20 % del texto
resaltado —el caso realista de ADR-012— el ahorro es menor todavía.

**Esto no cambia la decisión**, porque el motivo (a) la sostiene por sí solo: la
opción existe para que un usuario de Chrome de escritorio pueda publicar
`¿Cómo estás?` sin que se lea `¿Coḿo estaś?`. El ahorro de caracteres es un
efecto secundario agradable, no el argumento. Pero la interfaz del S05 **no debe
venderla como una forma de ganar espacio**: a ese titular le faltaría un factor
de cuatro.

---

## ADR-019 — Los offsets del modelo van en unidades UTF-16 ✅

**Contexto.** El glosario declaraba que `start` y `end` de un rango de estilo
eran offsets **en codepoints**. El S04 obliga a decidirlo de verdad, porque es
el sprint en el que esos números empiezan a viajar entre el modelo y el DOM en
cada pulsación.

La API `Range` del DOM —la que usan `Selection`, `setStart` y `setEnd`— trabaja
en unidades UTF-16 dentro de los nodos de texto: `range.startOffset` cuenta lo
mismo que `String.prototype.length`. Mantener el modelo en codepoints obligaría
a convertir en **cada** frontera DOM↔modelo, y esas fronteras se cruzan varias
veces por tecla: leer la selección, leer el DOM, restaurar el cursor.

**Decisión.** `start` y `end` se miden en **unidades UTF-16**, igual que
`text.length`. El glosario queda corregido.

**Motivo.** Cada conversión es un sitio donde equivocarse, y son muchos: una
sola de las dos direcciones mal hecha desplaza el cursor sin que se note hasta
que hay un emoji por medio. Hablar el mismo idioma que la API elimina la
categoría entera de error a cambio de nada, porque el riesgo teórico que traía
la alternativa no se materializa aquí:

- El editor solo contiene **texto latino normal**. Los caracteres del bloque
  matemático —los que sí ocupan dos unidades— tienen prohibida la entrada por
  ADR-003, y `editor.js` lleva una guardia que lo comprueba.
- Los pares subrogados aparecen únicamente en **emojis**, y ningún navegador
  deja colocar el cursor dentro de uno: la selección se mueve por grafemas.

Es decir: el caso en que codepoints y unidades UTF-16 difieren es exactamente
el caso en que el usuario no puede poner un offset.

**Consecuencias.**
- `model.js` documenta la unidad en su cabecera y ninguna de sus funciones
  convierte nada.
- `selection.js` suma `node.data.length` directamente al recorrer el árbol.
- **No afecta al contador dual (ADR-012).** El contador mide la cadena ya
  serializada con `Intl.Segmenter` y sigue midiendo grafemas y unidades UTF-16
  por separado. Son dos problemas distintos: aquí se trata de dónde está el
  cursor, allí de cuánto cree LinkedIn que ocupa el texto.
- Entrada «Range (rango de estilo)» del glosario actualizada.

---

## ADR-020 — `linkedom` como dependencia de desarrollo para probar el DOM ✅

**Contexto.** El S04 dejó `selection.js` sin tests automáticos: `node --test` no
trae DOM y la lista de dependencias de desarrollo de `CLAUDE.md` estaba acotada
a tailwindcss, esbuild y wrangler. El invariante que sostiene el editor —
`readModelFromDom(render(m)) === m` — se comprobó primero con un DOM de juguete
escrito para la ocasión, y después con `linkedom` en una pasada **fuera del
repositorio**, que por definición nadie puede volver a ejecutar (X-34).

**Decisión.** `linkedom` entra en `devDependencies`. La lista de dependencias
de desarrollo permitidas de `CLAUDE.md` pasa a ser **tailwindcss, esbuild,
wrangler y linkedom**.

**Motivo.**

1. **El round-trip es el invariante que sostiene el editor.** Las dos
   direcciones del flujo del S04 —al teclear se lee del DOM sin repintar, al
   pulsar negrita se repinta desde el modelo— solo son compatibles si repintar
   y volver a leer devuelve el mismo modelo. Si dejara de cumplirse, alternar
   entre teclear y aplicar estilo corrompería el texto de forma **silenciosa**:
   sin excepción, sin error en consola, y con el daño repartido a lo largo de
   una sesión de escritura. Es exactamente la clase de fallo que un test tiene
   que cubrir y una verificación manual no puede.
2. **Un DOM de juguete comprueba nuestras propias suposiciones sobre el DOM; uno
   real comprueba el DOM.** Lo que `selection.js` tiene que acertar es
   precisamente aquello sobre lo que un DOM escrito por nosotros no puede
   opinar: cómo el parser anida lo que escribe el navegador, qué queda como
   nodo de texto y qué como elemento, cómo se ordenan los hermanos. Un doble
   que nosotros mismos programamos pasa los tests por construcción cuando la
   suposición equivocada está en los dos lados a la vez.
3. **La restricción de «cero dependencias» es sobre el runtime, no sobre el
   tooling.** Es la misma lectura que ya fijó ADR-002 para tailwindcss.
   `linkedom` no se importa desde `public/`, no entra en el bundle, no se
   publica —vive fuera del directorio de assets (ADR-016)— y no llega al
   navegador: solo lo carga `node --test`.
4. **Una verificación que no está en `pnpm test` no existe.** Una pasada hecha
   fuera del repositorio no protege de una regresión dentro de seis semanas.

**Por qué `linkedom` y no jsdom o happy-dom.** Solo hace falta parsear HTML y
recorrer el árbol: `innerHTML`, `childNodes`, `nodeType`, `tagName`,
`nextSibling`, `parentNode`, `textContent` y `querySelector`. `linkedom` cubre
eso con una fracción del peso de jsdom y sin motor de CSS ni de layout, que no
se usan para nada aquí.

**Alcance.** Se importa **solo desde `tests/`**. Ningún archivo de `public/`
puede importarlo, ni directa ni indirectamente: el runtime sigue con cero
dependencias.

**Consecuencias.**
- `tests/roundtrip.test.js`: 18 tests. Los diez modelos representativos —vacío,
  acentos, anidados, solapamiento parcial, los cuatro estilos a la vez, saltos
  de línea, escapado de `< > &`, emoji sobre un par subrogado, viñetas y texto
  terminado en salto—, las siete formas que el navegador inserta por su cuenta
  —`<br>` suelto, `<br>` entre texto, `<div>` hermanos, `<b>`, `<i>`, `<span>`
  con estilo en línea y `<div><br></div>` final— y un test de convergencia que
  comprueba que lo leído de un árbol ajeno sobrevive a un repintado.
- **X-34 queda cerrada de verdad**, dentro de `pnpm test` y reproducible por
  cualquiera que clone el repositorio.
- Lo que sigue sin cubrir es lo que `linkedom` no simula: `Selection`,
  `Range`, eventos de composición, `caretPositionFromPoint` y el gesto de
  arrastre. `getSelection` y `setSelection` siguen verificándose a mano. La
  frontera es clara y conviene no moverla: `linkedom` prueba **lectura de
  árbol**, no interacción.
- La puerta no queda abierta. Cualquier otra dependencia de desarrollo sigue
  necesitando su propia ADR, con el mismo listón: que cubra un invariante que
  se rompería en silencio, y que no llegue al navegador.
