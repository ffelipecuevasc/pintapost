# Glosario

Términos que aparecen en la documentación y en el código. Sirve para que las
conversaciones con Claude Code sean precisas.

## Unicode y texto

**Codepoint.** Número que identifica un carácter en Unicode. Se escribe `U+1D5EE`.
No equivale necesariamente a "un carácter" en JavaScript.

**Par subrogado (surrogate pair).** JavaScript guarda las cadenas en UTF-16, con
unidades de 16 bits. Los codepoints por encima de `U+FFFF` —como todo el bloque
matemático— no caben y se representan con **dos** unidades. Por eso `"𝗮".length`
devuelve `2` y no `1`. Es la causa raíz del contador dual (ADR-012).

**Marca combinable (combining mark).** Carácter que no se dibuja solo, sino
encima o debajo del anterior. Usamos `U+0301` (acento agudo), `U+0303`
(virgulilla) y `U+0308` (diéresis). Ver ADR-005.

**Grafema / clúster de grafemas.** Lo que un humano percibe como "una letra".
Una `á` en negrita es un grafema formado por 3 unidades UTF-16: el par
subrogado de la `a` matemática más la marca combinable. `Intl.Segmenter` es la
API del navegador que sabe agruparlos correctamente.

**Mathematical Alphanumeric Symbols.** Bloque Unicode `U+1D400`–`U+1D7FF` que
contiene alfabetos completos en variantes bold, italic, script, fraktur,
double-struck, sans-serif y monospace. Existe para notación matemática; lo
usamos como vehículo de estilo porque LinkedIn lo preserva.

**Normalización (NFC/NFD).** Proceso que compone o descompone caracteres
equivalentes. Relevante porque `U+1D5EE + U+0301` **no** tiene forma compuesta,
así que sobrevive intacto a una normalización NFC.

## Arquitectura del editor

**Modelo.** La estructura `{ text: string, ranges: Range[] }` que es la fuente
de verdad del contenido. Ver ADR-003.

**Range (rango de estilo).** `{ start, end, style }` donde `start`/`end` son
offsets sobre `model.text` en **unidades UTF-16** —lo que cuenta
`String.prototype.length`, no codepoints— y `style` es `'bold'`, `'italic'`,
`'underline'` o `'strikethrough'`. La unidad la fija ADR-019: es la misma que
usa la API `Range` del DOM, así que `selection.js` traduce entre los dos mundos
sin convertir nada. Un carácter en negrita y cursiva pertenece a **dos rangos**,
no a uno con dos banderas.

**Range (API del DOM).** El objeto nativo `Range`, distinto del anterior pese al
nombre: representa un tramo del documento como dos pares `(nodo, offset)`. Sus
offsets se cuentan en unidades UTF-16 dentro de cada nodo de texto, y ese es el
motivo de ADR-019.

**Serializador.** Función pura que recibe el modelo y devuelve la cadena Unicode
final lista para el portapapeles. Se ejecuta solo al copiar. Su salida jamás
vuelve al editor.

**Render.** Función que recibe el modelo y produce el HTML del editor con
`<strong>` / `<em>` reales. Es lo que ve el usuario.

**Normalizar rangos.** Fusionar rangos adyacentes o solapados del mismo estilo,
y eliminar los vacíos. Se ejecuta tras cada mutación para que el modelo no
acumule basura.

**Las dos direcciones del flujo.** Al teclear va **DOM → modelo** y no se
repinta: el navegador escribe y `readModelFromDom` lee el resultado. Con
negrita, listas, pegado, deshacer y limpiar va **modelo → DOM** y sí se repinta,
porque el cambio no se puede expresar como una pulsación. Es la regla que
gobierna `editor.js`.

**Composición (tecla muerta).** Las dos pulsaciones con que un teclado español
produce `á` son una sola composición abierta del navegador. Entre
`compositionstart` y `compositionend` el editor **no toca el DOM**: repintar a
mitad pierde o duplica el acento. También es el camino de los teclados
predictivos de Android.

**`<br>` de relleno (filler).** Un `<br>` que no representa ningún salto de
línea, sino que da altura a una línea que si no sería invisible. Los navegadores
lo insertan solos en un bloque vacío, y `render.js` lo añade cuando el texto
termina en `\n`. `selection.js` lo distingue del salto real por su posición: es
relleno cuando no queda nada detrás de él dentro de su bloque.

**Ráfaga de escritura.** El grupo de teclas seguidas que el historial guarda
como un solo paso de deshacer. Se cierra tras 500 ms sin escribir, para que
`Ctrl+Z` no vaya letra por letra.

## Infraestructura

**Static Assets.** Capacidad de Cloudflare Workers para servir archivos
estáticos desde el edge. Sus peticiones son gratuitas y no consumen
invocaciones. Ver ADR-001.

**`run_worker_first`.** Opción de `wrangler.jsonc` que define qué rutas invocan
el código del Worker. La limitamos a `/api/*` para que servir el HTML no cueste
invocaciones.

**AI Gateway.** Proxy de Cloudflare que se coloca delante de un proveedor de IA
y aporta caché, rate limiting, reintentos y analítica sin escribir código.

**RPM / RPD / TPM.** Requests per minute / per day / tokens per minute. Los tres
límites del free tier de Gemini. Se aplican **por proyecto de Google Cloud**, no
por clave: crear varias claves no multiplica la cuota. El que nos limita es RPM.

**Turnstile.** Alternativa de Cloudflare a los CAPTCHA. En modo invisible el
usuario real no ve nada.

**Secreto de Worker.** Variable de entorno cifrada, inaccesible desde el
navegador. Donde vive la clave de Gemini. Nunca en el repositorio.

## Proceso

**Épica.** Agrupación de sprints con un objetivo de negocio común. Carpeta
`NN-epica-*`.

**Sprint.** Entrega incremental acotada, con criterios de aceptación
verificables. Archivo `sNN-*.md`.

**DoD (Definition of Done).** Lista de condiciones que debe cumplir cualquier
entrega antes de considerarse terminada. Definida en cada `_epica.md`.

**ADR (Architecture Decision Record).** Entrada de `decisiones.md`. Registra una
decisión, su motivo y sus consecuencias, para no volver a discutirla.
