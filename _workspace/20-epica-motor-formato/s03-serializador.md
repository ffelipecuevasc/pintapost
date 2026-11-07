# S03 — Motor de transformación Unicode

**Épica:** B — Motor de formato
**Estado:** 🟢 Cerrado (2026-08-31)
**Historias:** B-01, B-02, B-03, B-04, B-05

## Objetivo

Escribir el corazón del producto: funciones **puras**, sin DOM y sin estado, que
convierten texto normal en caracteres Unicode que LinkedIn preserva. Y probarlas
hasta el hartazgo, porque todo lo que venga después se apoya en esto.

Al terminar, PintaPost seguirá sin hacer nada visible. Pero tendrás la respuesta
a la pregunta de la que depende el proyecto entero: **¿sobrevive el formato al
pegarlo en LinkedIn, con tildes y eñes, en los cinco entornos objetivo?**

## Por qué este sprint va antes que el editor

Si la técnica de marcas combinables falla en Android o si LinkedIn cuenta los
caracteres de forma que haga inviable el producto, quieres saberlo **ahora**, con
200 líneas escritas, no después de haber construido el editor encima.

---

## Estructura al cerrar el sprint

```
public/static/js/
├── main.js
├── theme.js
└── format/
    ├── blocks.js       constantes de los bloques Unicode
    ├── unicode.js      transformación y reversa (API pública)
    └── counting.js     medición de longitudes
tests/
├── unicode.test.js
└── counting.test.js
```

Los módulos viven bajo `public/` porque el navegador los va a importar en el
S04. Los tests los importan desde `../public/static/js/format/…`.

---

## Tareas

### 1. Constantes de bloques (`blocks.js`)

- [x] Exportar los puntos de inicio de cada bloque **sans-serif** (ADR-004):

      | Estilo | Mayúsculas | Minúsculas | Dígitos |
      |---|---|---|---|
      | Bold | `0x1D5D4` | `0x1D5EE` | `0x1D7EC` |
      | Italic | `0x1D608` | `0x1D622` | *no existen* |
      | Bold Italic | `0x1D63C` | `0x1D656` | *no existen* |

- [x] Exportar las marcas combinables de estilo:
  `UNDERLINE = '\u0332'` (combining low line),
  `STRIKETHROUGH = '\u0336'` (combining long stroke overlay).
- [x] Comentar en el archivo **por qué son sans-serif y no serif**: el bloque
  *Mathematical Italic* serif no tiene `h` minúscula (`U+1D455` está
  reservado porque Unicode ya tenía ℎ en `U+210E`), y una fórmula de
  desplazamiento produciría ahí un carácter no asignado. Los sans-serif no
  tienen huecos.

### 2. Transformación (`unicode.js`)

**El algoritmo, en este orden exacto:**

1. Iterar el texto **por codepoints**, nunca por índices UTF-16.
2. Para cada carácter, aplicar `.normalize('NFD')` para separarlo en letra base
   más marcas diacríticas.
3. Transformar **solo la letra base** con la fórmula de desplazamiento.
4. Volver a añadir las marcas diacríticas detrás.
5. Si el estilo incluye subrayado o tachado, añadir su marca combinable al final
   de cada grafema.

- [x] Implementar `toStyled(text, style)` donde `style` es un objeto
  `{ bold, italic, underline, strikethrough }` con booleanos. Devuelve una
  cadena nueva; no muta nada.
- [x] Implementar la fórmula de desplazamiento para A–Z, a–z y 0–9.
- [x] Implementar `stripStyling(text)` que revierte cualquier carácter de los
  bloques matemáticos a su equivalente ASCII y elimina las marcas de
  subrayado y tachado, preservando las diacríticas del español. Es lo que
  usará "Limpiar formato" y lo que permitirá detectar texto ya estilizado
  pegado desde otra parte.
- [x] Implementar `isStyleable(char)` → `true` solo si tiene mapeo en algún
  bloque.

> ⚠️ **`normalize('NFD')` en lugar de una tabla de letras base.**
> `'á'.normalize('NFD')` devuelve `'a' + '\u0301'`. Descomponer con NFD resuelve
> las siete letras del español **y todas las demás latinas acentuadas** sin
> escribir ni una entrada a mano: à â ä ç ê ï õ… Si te ves creando un objeto
> `BASE_LETTER = { 'á':'a', … }`, has tomado el camino largo y frágil.
>
> Cuidado: NFD descompone, pero el resultado **no** debe recomponerse con NFC al
> final. `U+1D5EE + U+0301` no tiene forma compuesta, así que NFC lo dejaría
> igual, pero llamarlo es un paso inútil que confunde a quien lea el código.

**Reglas de no-transformación, todas obligatorias:**

- [x] Cualquier carácter sin mapeo pasa **intacto**: `¿ ¡ º ª « » €`, guiones
  largos, comillas tipográficas, espacios, saltos de línea, emojis.
- [x] Los dígitos en cursiva se dejan **sin transformar** (no existen en
  Unicode). Si el estilo es negrita-cursiva, un dígito recibe solo la
  negrita.
- [x] Los emojis y demás caracteres fuera del BMP deben atravesar la función sin
  romperse. Este es el test que falla si alguien usó `split('')`.

### 3. Medición (`counting.js`)

- [x] `count(text)` → `{ utf16, codepoints, graphemes }`.
  - `utf16` es `text.length`.
  - `codepoints` es `[...text].length`.
  - `graphemes` se calcula con `Intl.Segmenter` en modo `grapheme`.
- [x] Documentar en el archivo por qué importan los tres: es lo que alimenta el
  contador dual del S05 (ADR-012). Una `á` en negrita ocupa 3 unidades
  UTF-16, 2 codepoints y 1 grafema. Si LinkedIn cuenta por UTF-16, un post
  en negrita alcanza el límite de 3.000 a menos de la mitad de su longitud
  aparente.
- [x] Prever el caso de que `Intl.Segmenter` no exista (Safari antiguo): caer a
  `codepoints` sin romper.

### 4. Tests (`node --test`, sin librerías)

- [x] Añadir a `package.json`: `"test": "node --test tests/"`.
- [x] **Cobertura obligatoria** en `unicode.test.js`:

  | Caso | Qué comprobar |
    |---|---|
  | Abecedario | a–z y A–Z completos, en los tres estilos de bloque |
  | Dígitos | 0–9 en negrita transforman; en cursiva NO |
  | Español | á é í ó ú ü ñ y sus mayúsculas, en negrita y cursiva |
  | Diacríticas ajenas | à ê ï õ ç funcionan sin haberlas listado |
  | Sin mapeo | `¿ ¡ º ª « » €` salen idénticos |
  | Emojis | 😀 y 👨‍👩‍👧 atraviesan intactos |
  | Espacios | espacios, tabuladores y `\n` intactos |
  | Vacío | `toStyled('', …)` devuelve `''` |
  | Subrayado y tachado | se combinan con negrita y entre sí |
  | Idempotencia | aplicar negrita dos veces da el mismo resultado que una |
  | Reversibilidad | `stripStyling(toStyled(x, …)) === x` para todo el corpus |

- [x] Incluir un corpus en español de verdad, no `foo bar`. Frases con tildes,
  eñes, apertura de interrogación y exclamación, y algún emoji.
- [x] Los tests deben pasar con `pnpm test` sin instalar nada.

### 5. Verificación visual cross-device — **TAREA MANUAL, NO DE CLAUDE CODE**

Esta la ejecuto yo. Claude Code solo prepara el material.

- [x] Claude Code genera `tests/fixtures/cadena-de-prueba.txt` con un bloque de
  texto que contenga, en este orden y etiquetado: negrita completa del
  abecedario, cursiva completa, `áéíóúüñ ÁÉÍÓÚÜÑ` en negrita, lo mismo en
  cursiva, `¿Cómo estás? ¡Qué tal!` en negrita, dígitos en negrita, una
  línea con subrayado, otra con tachado, y una con emoji.
- [x] Pegar esa cadena en LinkedIn (sin publicar) y comprobar visualmente en:
  Windows/Chrome, macOS/Safari, Android/Chrome, iOS/Safari, y **la app
  móvil de LinkedIn**.
- [x] Anotar en `_workspace/90-manual/` el resultado por entorno, con especial
  atención a **si la tilde queda bien alineada** sobre la letra matemática.
  Es el riesgo aceptado en ADR-005.

**Resultado (2026-08-31):** en
`_workspace/90-manual/verificacion-cross-device.md`. Cuatro entornos de cinco,
limpios. En **Chrome de escritorio** el acento agudo se desplaza a la derecha y
cae sobre la consonante siguiente (`¿Cómo estás?` → `¿Cómo estás?`); la
virgulilla y la diéresis se posicionan bien, y los emojis salen enteros. Es el
riesgo aceptado en ADR-005, materializado en un entorno. De aquí sale **ADR-018**
y la tarea 8. Queda abierta una comprobación en el feed publicado, anotada en
ese mismo archivo.

### 6. Verificación empírica del contador de LinkedIn (B-05) — **MANUAL**

- [x] Claude Code genera un segundo fixture: exactamente 1.600 caracteres de
  texto plano, todos convertibles a negrita.
- [x] Pegarlo en LinkedIn **sin formato** y anotar qué dice el contador.
- [x] Pegarlo **todo en negrita** y anotar qué dice el contador.
- [x] Conclusión: si el segundo número ronda 3.200, LinkedIn cuenta por unidades
  UTF-16 y el contador dual del S05 es imprescindible. Si ronda 1.600,
  cuenta por codepoints o grafemas.
- [x] Registrar el resultado como una nota en ADR-012, que hoy lo tiene marcado
  como pendiente.

**Fixtures añadidos sobre lo planificado.**

> _Añadida por Claude Code el 2026-08-31._

El experimento se ejecutó con tres fixtures nuevos de 2.000 caracteres en lugar
del único de 1.600 que pedía la tarea: `contador-A-plano.txt`,
`contador-B-negrita.txt` y `contador-C-acentos.txt`. Los tres terminan con un
marcador visible en texto plano (` [FIN-A]`, ` [FIN-B]`, ` [FIN-C]`) para
detectar a simple vista un truncado. `contador-1600.txt` se conserva.

El tercero es el que decide: sus tres medidas se separan (6.008 UTF-16 / 4.008
codepoints / 2.008 grafemas), así que un solo número distingue las tres
hipótesis en vez de dos.

**Resultado (2026-08-31):** LinkedIn cuenta **unidades UTF-16**. Registrado en
ADR-012, con las cifras y sus consecuencias. B-05 pasa a 🟢 en el backlog.

### 7. `stripStyling` tolerante a todos los bloques matemáticos

> _Añadida por Claude Code el 2026-08-31._

Tarea emergente: sale del repaso de casos Unicode no cubiertos que se hizo
al recorrer los criterios de aceptación, no de la planificación del sprint.

**Motivo.** `toStyled` debe ser **estricto** en lo que produce (solo sans-serif,
ADR-004), pero `stripStyling` debe ser **tolerante** en lo que acepta. Al cerrar
la tarea 2 las dos eran estrictas, y eso significaba que el texto pegado desde
otro formateador de LinkedIn —casi todos usan el bloque serif— no se limpiaba.
En el S04 `stripStyling` será lo que normalice el pegado, así que esos
caracteres entrarían al modelo `{ text, ranges }`, que es justo lo que ADR-003
prohíbe. Una función que solo sabe deshacer lo que ella misma hizo no sirve para
limpiar lo que llega de fuera.

- [x] Aplicar `normalize("NFKD")` de forma **selectiva**: solo a los caracteres
  que estén en el rango matemático (`U+1D400`–`U+1D7FF`) o en la lista de
  sustitutos de *Letterlike Symbols* que rellenan los huecos reservados
  (ℎ ℬ ℰ ℱ ℋ ℐ ℒ ℳ ℛ ℭ ℌ ℑ ℜ ℨ ℂ ℍ ℕ ℙ ℚ ℝ ℤ ℯ ℊ ℴ). NFKD los revierte todos.
- [x] **No** aplicar NFKD a la cadena entera: convertiría `ﬁ` en `fi`, `①` en
  `1` y `㎡` en `m2`, alterando el contenido del usuario. La comprobación de
  rango es exactamente lo que separa limpiar formato de reescribir contenido.
- [x] Tests de ida y vuelta desde serif, script, fraktur, doble raya y
  monoespaciada, con el abecedario completo y los huecos rellenos con sus
  sustitutos, que es como los genera una herramienta real.
- [x] Test de los 24 sustitutos de *Letterlike Symbols*, uno a uno.
- [x] Test negativo: `ﬁ ① ² ㎡ ™ ℓ № ½ Ⅷ` **no** se transforman.
- [x] Test que vigila que `toStyled` sigue siendo estricto: ningún codepoint de
  su salida cae en el bloque matemático fuera de los tres rangos sans-serif.
- [x] Documentar la asimetría estricto/tolerante en la cabecera de `unicode.js`.

**Consecuencias registradas.** El inverso explícito `unshiftToAscii` desaparece:
los tres bloques del proyecto viven dentro de `U+1D400`–`U+1D7FF`, así que NFKD
ya los cubre y mantener dos mecánicas obligaría a tenerlas de acuerdo para
siempre. Como efecto colateral, `stripStyling` deja de devolver siempre ASCII:
los alfabetos griegos matemáticos del mismo rango revierten a griego normal
(`𝚨𝚩𝚪` → `ΑΒΓ`), que es la misma letra sin estilo. Los 28 huecos reservados no
tienen a qué revertir y pasan intactos.


### 8. Opción de máxima compatibilidad `styleCombining` (ADR-018)

> _Añadida por Claude Code el 2026-08-31._

Tarea emergente: sale del resultado de la verificación cross-device (tarea 5) y
de la medición del contador de LinkedIn (tarea 6), no de la planificación del
sprint.

**Motivo.** Dos problemas independientes con una sola solución. En Chrome de
escritorio el acento agudo sobre una base matemática se descoloca, y una vocal
acentuada en negrita cuesta 3 unidades UTF-16 frente a 1 en plano, que es la
moneda con la que LinkedIn mide el límite (ADR-012). Dejar sin estilizar las
letras con diacrítica arregla lo primero y abarata lo segundo.

- [x] Añadir la opción `styleCombining` a `toStyled`, **`true` por defecto**:
  sin ella, el comportamiento no cambia en nada.
- [x] Con `false`, todo grafema que tras `NFD` lleve marcas combinables se emite
  **tal cual llegó**, sin transformar la base. Se conserva **precompuesto**
  (`ó` = U+00F3, 1 unidad UTF-16): devolverlo en NFD costaría 2 y se comería
  la mitad del ahorro.
- [x] El subrayado y el tachado **sí** se siguen aplicando: son marcas de
  estilo que añade el motor, no diacríticas del idioma que escribió el
  usuario.
- [x] La regla es amplia a propósito: alcanza a `ñ` y `ü`, que se renderizan
  bien, y a las diacríticas ajenas (`à ê ï õ ç`). Una regla explicable en una
  frase vale más que una excepción por marca que nadie recordará.
- [x] Documentar la opción en la cabecera de `unicode.js` y en el JSDoc de
  `toStyled`.
- [x] Tests (9 nuevos, `describe("styleCombining")`):
  - `"canción"` con la opción desactivada da la `ó` en texto plano y las otras
    seis letras en negrita.
  - Round-trip: `stripStyling(toStyled(x, sin))` === `x` en el corpus completo
    × las nueve combinaciones de estilo.
  - Medición con `count()`: el resultado ocupa **menos unidades UTF-16** que
    con la opción activa, y exactamente 2 menos por letra acentuada, sin que
    cambie el número de grafemas.
  - El defecto (`true`) produce byte a byte lo mismo que antes de esta tarea.
  - Idempotencia, subrayado y tachado sobre letra acentuada, y emojis.

**No entra aquí la interfaz.** La casilla que expone la opción al usuario es del
**S05**, junto al contador. Esta tarea deja solo el motor.

**Verificación.** `pnpm test` → 65 tests, 20 suites, 0 fallos (eran 56 y 19).
Mutaciones de control sobre la lógica nueva: desactivar la opción produjo 5
fallos; no aplicar subrayado ni tachado, 1; emitir en NFD en vez de
precompuesto, 4.

---

## Criterios de aceptación

- [x] `pnpm test` pasa, sin dependencias externas.
- [x] `stripStyling(toStyled(x, cualquierEstilo)) === x` para todo el corpus.
- [x] Ninguna función del sprint toca el DOM, `window`, `document` ni
  `localStorage`. Son módulos puros.
- [x] Ninguna función usa `split('')`, `charAt` ni indexación `text[i]`.
- [x] Los emojis atraviesan la transformación sin romperse.
- [x] Existen los dos fixtures de las tareas 5 y 6.
- [x] `pnpm run build` sigue funcionando y el sitio se sirve igual: **este
  sprint no debe cambiar nada visible**.

## Verificación de los criterios

> _Añadida por Claude Code el 2026-08-31._

Recorridos uno a uno el 2026-08-31, todos en verde:

1. `pnpm test` → 56 tests, 19 suites, 0 fallos. Únicos imports: `node:test`,
   `node:assert/strict` y los módulos del propio proyecto.
2. Reversibilidad → test sobre 9 textos × 9 estilos, incluido el vacío.
3. Pureza → `grep` de `document`, `window`, `localStorage` sin coincidencias en
   código; la única está en un comentario.
4. Sin `split('')`, `charAt` ni `charCodeAt`. Las cinco indexaciones por
   corchetes son sobre `[...text]`, un array de codepoints, nunca sobre cadena.
5. Emojis → 3 tests con 😀 👨‍👩‍👧 🇨🇱 👍🏽 1️⃣ en los tres estilos de bloque.
6. Fixtures → `cadena-de-prueba.txt` (2.492 b) y `contador-1600.txt` (1.600 b
   exactos, solo `[A-Za-z0-9]`, sin salto final).
7. `pnpm run build` correcto y `tailwind.css` idéntico byte a byte antes y
   después (md5 `36c1804c…`). El commit no toca `index.html`, `main.js`,
   `theme.js` ni `styles.css`.

Mutaciones de control: alterar una constante de bloque produjo 5 fallos, y las
dos mutaciones sobre la tolerancia de `stripStyling`, 3 cada una.

### Reverificación tras la tarea 8

> _Añadida por Claude Code el 2026-08-31._

Los siete criterios se recorrieron otra vez el 2026-08-31, ya con
`styleCombining` dentro, y siguen todos en verde:

1. `pnpm test` → **65 tests, 20 suites, 0 fallos**, sin dependencias externas.
2. Reversibilidad → ahora sobre 9 textos × 9 estilos × **2 modos** de
   `styleCombining`, incluido el texto vacío.
3. Pureza → la lógica nueva no introduce ningún acceso a `document`, `window`
   ni `localStorage`.
4. Sin `split('')`, `charAt` ni indexación de cadena: la comprobación de marcas
   se hace con un `RegExp` de propiedad Unicode (`\p{M}`) sobre el grafema ya
   agrupado.
5. Emojis → cubiertos también en el modo nuevo.
6. Fixtures → los dos de las tareas 5 y 6, más los tres de 2.000 caracteres
   añadidos para el experimento del contador.
7. `pnpm run build` correcto y `tailwind.css` **idéntico byte a byte**
   (md5 `36c1804c…`, el mismo de antes del sprint). Este sprint sigue sin
   cambiar nada visible.

## Definition of Done

1. Todas las casillas de las tareas 1 a 4 marcadas.
2. `pnpm test` y `pnpm run build` en verde.
3. ~~Las tareas 5 y 6 quedan **abiertas** hasta que yo ejecute las pruebas
   manuales.~~ → **Ejecutadas el 2026-08-31.** Las dos cerradas: la 5 con
   hallazgo (ADR-018 y tarea 8) y la 6 con resultado registrado en ADR-012.
   Queda un solo cabo suelto, anotado en
   `_workspace/90-manual/verificacion-cross-device.md`: comprobar el
   renderizado en el **feed publicado**, no solo en el compositor. No bloquea
   el cierre del S03; decide el valor por defecto de ADR-018 en el S05.
4. Commit en Conventional Commits.
5. Bitácora actualizada.

---

## Notas para Claude Code

- **Este sprint no tiene interfaz.** No toques `index.html` ni `main.js` salvo
  para nada. Si te ves escribiendo un `addEventListener`, has salido del alcance.
- **No implementes el modelo `{text, ranges}`.** Eso es el S04. Aquí solo se
  transforman cadenas.
- **No implementes la detección de hashtags y menciones.** Es B-17, del S05.
- Prefiere claridad a brevedad: este código lo va a leer alguien dentro de un
  año intentando entender por qué una tilde se ve torcida en un Android.
- Si encuentras un caso Unicode que no está contemplado en este sprint,
  **anótalo en el backlog y sigue**. No inventes política sobre la marcha.
- Al terminar, dime explícitamente qué casos NO cubriste y por qué.

## Pendientes para la consola web

Ninguno. Las tareas 5 y 6 son manuales pero no requieren consola: son pruebas
en LinkedIn.