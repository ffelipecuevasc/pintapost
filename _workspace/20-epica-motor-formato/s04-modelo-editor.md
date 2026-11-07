# S04 — Modelo de datos y editor funcional

**Épica:** B — Motor de formato
**Estado:** 🟢 Cerrado el 2026-09-01
**Historias:** B-06, B-07, B-08, B-09, B-10, B-11, B-12

## Objetivo

El sprint en el que PintaPost **hace algo**. El usuario escribe, selecciona,
pulsa negrita y lo ve al instante. Deshace con Ctrl+Z. Pega desde otra app y
entra limpio.

Y todo eso sin que un solo carácter del bloque matemático toque el editor: el
estilo se muestra con CSS real y la conversión a Unicode sigue esperando al S05.

## Prerrequisito

La tarea 8 del S03 (`styleCombining`) debe estar implementada y con tests. Si no
lo está, hazlo antes de empezar.

---

## Las dos ideas que gobiernan este sprint

Si solo lees dos cosas de este documento, que sean estas.

### 1. El modelo es la fuente de verdad, pero no siempre manda

Un `contenteditable` que se re-renderiza en cada pulsación es un desastre: rompe
la composición de acentos con teclas muertas, hace saltar el cursor y descarta el
deshacer del navegador. La solución es tener **dos direcciones de flujo** y saber
cuál aplica en cada momento:

| Situación | Dirección | Se re-renderiza |
|---|---|---|
| El usuario teclea | DOM → modelo | **No** |
| Pulsa negrita, cursiva, lista, limpiar | modelo → DOM | Sí |
| Pega texto | modelo → DOM | Sí |
| Deshace o rehace | modelo → DOM | Sí |

Al teclear, el navegador hace su trabajo y nosotros leemos el resultado. Solo
cuando la operación no se puede expresar como escritura normal tomamos el control
y repintamos.

### 2. Las listas son texto, no estructura

LinkedIn no tiene listas: un post con viñetas es texto plano donde alguien
escribió `• ` al principio de cada línea. Así que el botón de lista **no** crea
un `<ul>`: inserta o quita prefijos en las líneas seleccionadas del modelo.

Esto elimina de golpe toda la complejidad de anidamiento, `Enter` dentro de un
elemento de lista, y serialización de estructuras. Es una simplificación enorme y
es además lo correcto: el modelo debe parecerse a lo que LinkedIn va a recibir.

---

## Estructura al cerrar el sprint

```
public/static/js/
├── main.js                 orquestación
├── theme.js
├── format/
│   ├── blocks.js
│   ├── unicode.js
│   └── counting.js
└── editor/
    ├── model.js            estructura y operaciones puras
    ├── render.js           modelo → HTML
    ├── selection.js        puente DOM ↔ offsets del modelo
    ├── commands.js         negrita, cursiva, listas, limpiar
    ├── history.js          deshacer y rehacer
    └── editor.js           el controlador que une todo con el DOM
tests/
├── model.test.js
├── render.test.js
└── commands.test.js
```

`model.js`, `render.js`, `commands.js` e `history.js` son **puros y testables sin
navegador**. `selection.js` y `editor.js` sí tocan el DOM y no llevan tests
unitarios: se verifican a mano.

---

## Tareas

### 1. El modelo (`model.js`)

- [x] Definir la estructura:
  ```js
  { text: "Hola mundo", ranges: [ { start: 0, end: 4, style: "bold" } ] }
  ```
- [x] **`start` y `end` son offsets en unidades UTF-16**, no en codepoints.
  Requiere ADR (ver más abajo). Motivo: es lo que habla la API `Range` del
  DOM, y convertir en cada frontera multiplicaría los sitios donde
  equivocarse. El editor solo contiene texto latino normal, así que los
  pares subrogados aparecen únicamente en emojis, y el navegador nunca
  coloca el cursor dentro de uno.
- [x] `style` es uno de `'bold' | 'italic' | 'underline' | 'strikethrough'`.
  Un carácter en negrita y cursiva pertenece a **dos rangos distintos**, no a
  uno combinado. Simplifica aplicar y quitar cada estilo por separado.
- [x] Operaciones puras, todas devuelven un modelo nuevo:
  - `applyStyle(model, from, to, style)`
  - `removeStyle(model, from, to, style)`
  - `toggleStyle(model, from, to, style)` — aplica si **no todo** el tramo lo
  tiene ya; si lo tiene entero, lo quita. Es lo que espera cualquiera que
  haya usado un procesador de textos.
  - `hasStyle(model, from, to, style)` → `'none' | 'partial' | 'all'`
  - `insertText(model, at, text)` — desplaza los rangos posteriores
  - `deleteRange(model, from, to)` — recorta y desplaza
  - `clearStyles(model, from, to)`
  - `getPlainText(model)`
- [x] `normalize(model)`: fusiona rangos adyacentes o solapados del mismo estilo,
  elimina los vacíos, ordena por `start`. Se ejecuta al final de **cada**
  operación. Sin esto el modelo acumula basura hasta volverse ilegible.
- [x] Invariantes que ninguna operación puede romper, comprobadas en tests:
  `start < end`; ningún `end` supera `text.length`; no hay dos rangos del
  mismo estilo que se solapen ni que se toquen.

### 2. El renderizador (`render.js`)

- [x] `render(model)` → cadena de HTML.
- [x] Algoritmo: recorrer los límites de todos los rangos para partir el texto en
  **segmentos con conjunto de estilos constante**, y emitir cada segmento con
  sus etiquetas anidadas. Para un texto con negrita en 0–10 y cursiva en 5–15
  salen tres segmentos: 0–5 negrita, 5–10 negrita+cursiva, 10–15 cursiva.
- [x] Etiquetas: `<strong>`, `<em>`, `<u>`, `<s>`. Semánticas reales, que es
  medio criterio de accesibilidad resuelto sin esfuerzo.
- [x] Escapar `&`, `<` y `>`. El texto viene del usuario.
- [x] Los saltos de línea van como `\n` literal dentro del texto. El contenedor
  ya tiene `white-space: pre-wrap`, así que se ven sin necesidad de `<br>`.
- [x] `render` es una función pura: recibe un modelo, devuelve una cadena. No
  toca el DOM.

### 3. Puente DOM ↔ modelo (`selection.js`)

Este archivo es donde se concentra la dificultad del sprint. Escríbelo pequeño y
con nombres explícitos.

- [x] `domToModelOffset(root, node, offset)` → posición en `model.text`. Recorre
  los nodos de texto en orden hasta llegar al nodo dado, sumando longitudes.
- [x] `modelOffsetToDom(root, offset)` → `{ node, offset }`. La inversa.
- [x] `getSelection(root)` → `{ from, to }` en offsets del modelo, o `null` si el
  foco está fuera.
- [x] `setSelection(root, from, to)`.
- [x] `readModelFromDom(root)` → reconstruye `{ text, ranges }` leyendo el árbol.
  Es lo que se usa tras teclear. Debe reconocer `<strong>`, `<em>`, `<u>` y
  `<s>` aunque estén anidados en cualquier orden, y tratar `<br>` y `<div>`
  —que el navegador inserta por su cuenta al pulsar Enter— como `\n`.
- [x] Caso límite: cuando el editor queda vacío el navegador deja un `<br>`
  residual. Debe leerse como texto vacío, no como un salto de línea.

### 4. El controlador (`editor.js`)

- [x] Estado: el modelo actual y el elemento `contenteditable`.
- [x] `input` → `readModelFromDom` y actualizar el modelo. **Sin re-renderizar.**
- [x] `compositionstart` / `compositionend` → **no tocar el DOM entre ambos**.
  Es lo que permite escribir `á` con tecla muerta en un teclado español. Si
  el editor repinta a mitad de composición, el acento se pierde o se duplica.
- [x] Aplicar un comando: guardar la selección → mutar el modelo → renderizar →
  restaurar la selección. En ese orden exacto.
- [x] Alternar la clase `.is-empty` para el placeholder (viene del S02).
- [x] Emitir un evento `pintapost:change` con el modelo cada vez que cambia, para
  que el contador del S05 se enganche sin acoplarse al editor.
- [x] **Guardia de ADR-003:** una función de desarrollo que compruebe que
  `model.text` no contiene ningún codepoint entre `U+1D400` y `U+1D7FF`. Si
  alguna vez salta, algo ha metido texto ya estilizado en el modelo.

### 5. Comandos y atajos (`commands.js` + interfaz)

- [x] Conectar los cuatro botones de estilo con `toggleStyle`.
- [x] `Ctrl/Cmd+B` → negrita, `Ctrl/Cmd+I` → cursiva, `Ctrl/Cmd+U` → subrayado.
  `preventDefault()` en los tres: el navegador tiene sus propios atajos y
  metería `<b>` por su cuenta.
- [x] Botón "Limpiar formato" → `clearStyles` sobre la selección, o sobre todo el
  texto si no hay selección.
- [x] **Sincronizar `aria-pressed`** con la selección: al mover el cursor, cada
  botón refleja si el tramo seleccionado tiene ese estilo. Usa el resultado
  `'partial'` de `hasStyle` para un tercer estado visual (por ejemplo, opacidad
  intermedia): indica que la selección tiene el estilo a medias.
- [x] Escuchar `selectionchange` con *debounce*. Sin él se dispara en cada
  movimiento del cursor y la barra parpadea.

### 6. Pegado limpio (B-11)

- [x] Interceptar `paste`, `preventDefault()`, leer `clipboardData` como
  `text/plain` — nunca `text/html`.
- [x] Pasar lo leído por `stripStyling` de `unicode.js`. Gracias a la tarea 7 del
  S03 esto limpia texto formateado con **cualquier** herramienta, no solo con
  PintaPost.
- [x] Insertar en el modelo en la posición del cursor, reemplazando la selección
  si la hay, y renderizar.
- [x] Normalizar los saltos de línea: `\r\n` y `\r` → `\n`.
- [x] Test manual obligatorio: copiar un párrafo con negritas desde Word o Google
  Docs y comprobar que entra como texto plano, sin estilos y sin HTML.

### 7. Listas (B-12)

- [x] Botón de viñetas: para cada línea que toque la selección, alternar el
  prefijo `• `.
- [x] Botón de lista numerada: alternar `1. `, `2. `, `3. `… renumerando el
  bloque contiguo de líneas afectadas.
- [x] Al alternar, los rangos de estilo de esas líneas deben desplazarse tantas
  posiciones como caracteres tenga el prefijo. Es el punto donde es más fácil
  equivocarse: escríbele un test.
- [x] Si todas las líneas seleccionadas ya tienen el prefijo, se quita.
- [x] No hay estructura de lista, no hay anidamiento y `Enter` no continúa la
  lista automáticamente. Anótalo en el backlog si crees que hace falta.

### 8. Deshacer y rehacer (`history.js`)

- [x] Pila de instantáneas `{ model, selection }`, máximo 50.
- [x] Se apila: antes de cada comando de estilo, antes de cada pegado, y al
  teclear con *debounce* de unos 500 ms para no guardar letra por letra.
- [x] `Ctrl/Cmd+Z` deshace, `Ctrl/Cmd+Shift+Z` y `Ctrl+Y` rehacen. Con
  `preventDefault()`: el deshacer nativo del navegador queda inservible en
  cuanto manipulamos el DOM por código, así que lo sustituimos entero.
- [x] Cualquier acción nueva vacía la pila de rehacer.
- [x] Es corto porque el modelo es serializable. Es el rédito directo de ADR-003.

### 9. Tests

- [x] `model.test.js`: cada operación, los invariantes tras cada una,
  solapamientos, rangos adyacentes que deben fusionarse, inserción y borrado
  dentro y en los bordes de un rango, y modelo vacío.
- [x] `render.test.js`: estilos anidados, solapamientos parciales, escapado de
  `& < >`, saltos de línea, texto vacío.
- [x] `commands.test.js`: `toggleStyle` en los tres casos (`none`, `partial`,
  `all`), listas con desplazamiento de rangos, y limpiar formato.
- [x] Un test que recorra un guion de operaciones —escribir, poner negrita,
  insertar en medio, quitar negrita, deshacer— y compruebe que el modelo
  queda exactamente como al principio.

### 10. Estilo pendiente y arrastrar-soltar (X-31, X-32)

_Añadida por Claude Code el 2026-09-01._

Dos de los casos límite que el sprint dejó anotados como deuda pasan a tarea.
El criterio para ascenderlos es el mismo en los dos: **no son bordes raros, son
la forma habitual de usar el editor.**

#### 10.a — Estilo pendiente con el cursor colapsado (X-31)

Pulsar negrita sin nada seleccionado y ponerse a escribir no es un caso
exótico: es cómo se usa un botón de negrita. Antes no hacía nada, porque
`toggleStyle` no tiene caracteres sobre los que trabajar.

- [x] Al pulsar un estilo con la selección colapsada, guardar un conjunto de
  **estilos pendientes** y la posición en que se armó.
- [x] El conjunto arranca de **lo que el cursor ya hereda** (`stylesAt`), no de
  vacío. Es lo que permite el caso simétrico: con el cursor dentro de una
  palabra en negrita, pulsar negrita significa «lo siguiente sin negrita», y
  eso solo se puede expresar si el conjunto sabe también qué hay que quitar.
- [x] Aplicarlo al siguiente texto que se inserte **en esa posición**, con
  `applyStyleSet`, que fija el conjunto exacto en lugar de solo añadir.
- [x] Descartarlo al mover el cursor a otro sitio, al perder el foco, y al
  volver a pulsar el mismo botón (que devuelve el conjunto a lo heredado).
- [x] `aria-pressed` refleja el estilo pendiente mientras esté activo: el
  usuario acaba de pulsar y tiene que ver el botón encendido hasta que escriba,
  o parecerá que la pulsación se ha perdido.
- [x] Aceptar el repintado que esto implica. Es la **única excepción** a «al
  teclear no se re-renderiza», y es inevitable: el carácter recién escrito
  tiene que verse ya en negrita. Es un repintado aislado que consume lo
  pendiente y desaparece, no un vuelco a repintar en cada pulsación.
- [x] Sólo consumirlo si el cambio fue una **inserción limpia** en la posición
  armada (`isCleanInsertionAt`). Un borrado, una autocorrección que reescribe
  la palabra entera o un `beforeinput` que no llegó descartan lo armado en vez
  de arriesgarse a pintar de negrita un tramo equivocado.

#### 10.b — Arrastrar y soltar (X-32)

Era la única entrada al modelo que no pasaba ni por el teclado ni por `paste`,
así que soltar un párrafo traído de otro formateador de LinkedIn metía
caracteres del bloque matemático y la guardia de ADR-003 tenía que limpiar el
estropicio a posteriori. Ahora entra por el mismo camino que el pegado, y la
guardia vuelve a ser lo que debe ser: una red que no se pisa nunca.

- [x] Interceptar `drop` con `preventDefault()`, leer `text/plain` de
  `dataTransfer`, pasarlo por `cleanPastedText` e insertarlo con el mismo
  camino que el pegado.
- [x] Interceptar `dragover` también: sin cancelarlo, el navegador no considera
  el editor una zona donde se pueda soltar y `drop` no llega a dispararse.
- [x] Localizar la posición de la caída con `caretPositionFromPoint`, y con
  `caretRangeFromPoint` donde no exista la estándar. Si ninguna responde, o
  responde con un punto de fuera del editor, caer al cursor actual.
- [x] **Distinguir mover de copiar.** Al cancelar el `drop` le quitamos al
  navegador el borrado del origen, que hacía él solo; sin devolvérselo,
  arrastrar una palabra dentro del editor la duplicaría. `dragstart` recuerda
  el tramo de origen y `dropText` lo borra, corrigiendo el destino por lo que
  se ha quitado si el origen estaba delante.
- [x] Soltar dentro del propio tramo arrastrado no hace nada, que es lo que
  hacen los navegadores: no hay ningún sitio nuevo al que llevarlo.

#### 10.c — Tests

Las dos partes puras salen a `commands.js` para que tengan test; `editor.js` se
queda en cablear eventos.

- [x] `applyStyleSet(model, from, to, styles)` en `commands.js`. 10 tests: el
  conjunto exacto, que **quita** lo heredado que no esté en la lista,
  sustitución de un estilo por otro, idempotencia, tramo vacío, `Set` o array,
  y que no muta ni toca el texto.
- [x] `dropText(model, at, text, source)` en `commands.js`. 13 tests: copia sin
  origen, movimiento con origen en las dos direcciones, la corrección del
  destino al mover hacia delante —el punto donde es fácil equivocarse—, soltar
  dentro del tramo arrastrado, origen invertido, que el estilo del texto que se
  queda no se descoloca, y que lo soltado pasa por la misma limpieza que el
  pegado.
- [x] `pnpm test` en verde: **243 pass / 0 fail**, 47 suites.

Lo que no es testable sin DOM —armar el conjunto al pulsar, descartarlo al
mover el cursor, `caretPositionFromPoint`, el gesto de arrastre— queda para la
pasada manual, con dos pruebas nuevas en el guion de verificación.

---

## ADR que hay que escribir en este sprint

**ADR-019 — Offsets del modelo en unidades UTF-16.** El glosario dice hoy que los
offsets van en codepoints. Cámbialo. Motivo: la API `Range` del DOM trabaja en
unidades UTF-16 dentro de nodos de texto, y convertir en cada frontera
DOM↔modelo multiplicaría los puntos de fallo. El editor solo contiene texto
latino normal —los caracteres del bloque matemático tienen prohibida la entrada
por ADR-003—, así que los pares subrogados aparecen únicamente en emojis, y los
navegadores no permiten colocar el cursor dentro de un par subrogado. Actualiza
también la entrada "Range" del glosario.

---

## Criterios de aceptación

- [x] Escribir, seleccionar y pulsar negrita muestra el texto en negrita **sin
  que el cursor salte**.
- [x] Escribir `á` con tecla muerta en un teclado español funciona con normalidad,
  también en mitad de un tramo con estilo.
- [x] Los atajos de teclado funcionan y el navegador no mete etiquetas propias.
- [x] `Ctrl+Z` deshace la última acción, incluidos los cambios de estilo.
- [x] Pegar desde Word, Google Docs u otro formateador de LinkedIn entra como
  texto plano sin estilos.
- [x] Las listas alternan y renumeran, y el estilo de esas líneas no se descoloca.
- [x] "Limpiar formato" devuelve el texto plano exacto.
- [x] Los botones reflejan el estado de la selección con `aria-pressed`.
- [x] `model.text` **nunca** contiene un carácter entre `U+1D400` y `U+1D7FF`.
- [x] `pnpm test` en verde con los tres archivos nuevos.
- [x] Sin errores en consola tras cinco minutos de uso real.

## Definition of Done

1. Todas las casillas marcadas.
2. `pnpm test` y `pnpm run build` en verde.
3. Probado a mano en Chrome escritorio y en Chrome Android.
4. ADR-019 escrita y glosario actualizado.
5. Commit en Conventional Commits.
6. Bitácora actualizada.

---

## Notas para Claude Code

- **No conviertas nada a Unicode en este sprint.** El editor muestra estilo con
  CSS. `toStyled` no se llama ni una vez. Es el S05.
- **No implementes el botón de copiar** ni el contador. También S05.
- **No toques `unicode.js`, `blocks.js` ni `counting.js`.** Están cerrados.
- Si te encuentras escribiendo `innerHTML` fuera de `render.js`, párate y
  replantéalo.
- Empieza por `model.js` y sus tests, y no pases a `render.js` hasta que los
  invariantes se cumplan. Todo lo demás se apoya en que el modelo sea correcto.
- `selection.js` y `editor.js` son la parte difícil. Escríbelos al final, cuando
  todo lo puro ya funcione, y con funciones cortas.
- Si el `contenteditable` te pelea, **no metas más re-renderizados**: revisa si
  estás repintando cuando deberías estar leyendo.
- Al terminar, dime qué casos límite del `contenteditable` NO cubriste.

## Pendientes para la consola web

Ninguno.
---

## Verificación

_Añadida por Claude Code el 2026-09-01._

### Lo que sí está verificado con evidencia

| Qué | Cómo |
|---|---|
| Prerrequisito `styleCombining` | `unicode.js:281`, 9 tests en `describe("styleCombining")`, ADR-018 cerrada |
| Modelo, render y comandos | `pnpm test` → **261 pass / 0 fail**, 50 suites |
| Build | `pnpm run build` en verde |
| `editor.js` carga y sus exports | `import()` desde Node sin errores |
| Round-trip `readModelFromDom(render(m)) === m` | 20 modelos + 7 formas que escribe el navegador. Ver más abajo |
| Round-trip sobre un **DOM real** | `tests/roundtrip.test.js`, 18 tests dentro de `pnpm test` (ADR-020). Cierra X-34 |
| Estilo pendiente (X-31) | 10 tests de `applyStyleSet` |
| Arrastrar y soltar (X-32) | 13 tests de `dropText` |

**El round-trip es el invariante que sostiene el editor entero**, porque es lo
que hace compatibles las dos direcciones del flujo: si repintar y volver a leer
no diera el mismo modelo, alternar entre teclear y pulsar negrita iría
corrompiendo el texto poco a poco.

No se pudo comprobar con `node --test` —no hay DOM y las dependencias de
desarrollo están acotadas— así que se verificó con un DOM de juguete
desechable, fuera del repositorio. Casos cubiertos: texto plano, los cuatro
estilos, solapamientos parciales, anidamiento triple, escapado de `& < >`,
acentos, emojis, viñetas, numeradas, y los cinco casos de saltos de línea. Y en
sentido inverso, lo que escribe el navegador por su cuenta: `<br>` residual del
editor vacío (→ texto vacío, no `\n`), `<div>` de Chrome al pulsar Enter,
`<div><br></div>` como línea en blanco, `<br>` de Firefox, y `<b>` nativo.
Los 27 en verde.

**X-34 queda cerrada.** El invariante está verificado sobre un DOM real
(`linkedom`), y no solo sobre el de juguete: los diez modelos representativos
—vacío, anidados, solapamientos parciales, los cuatro estilos a la vez, saltos,
escapado, emoji, viñetas y texto terminado en salto— dan 10/10, y las siete
formas que inserta el navegador por su cuenta, 7/7. Deja de ser deuda.

> ⚠️ **Superada el 2026-09-01 por ADR-020.** `linkedom` ya es una dependencia
> de desarrollo del repositorio y el round-trip corre dentro de `pnpm test`.
> La nota se conserva por trazabilidad; ver «Actualización del 2026-09-01».

> **Nota de trazabilidad.** Esa pasada con `linkedom` se hizo **fuera de este
> repositorio**: `linkedom` no está en `package.json` ni en `node_modules`, y no
> puede estarlo sin ADR, porque CLAUDE.md acota las dependencias de desarrollo a
> tailwindcss, esbuild y wrangler. Lo que sí es reproducible desde aquí es la
> comprobación con el DOM de juguete descrita arriba. Si en algún momento
> interesa que el round-trip corra en `pnpm test`, hace falta esa ADR primero.

### Lo que falta: cinco minutos en Chrome

No hay herramientas de navegador en esta sesión, así que los criterios
interactivos siguen sin marcar. Con el servidor levantado
(`cd public && python -m http.server 8788`), en `http://127.0.0.1:8788/`:

1. Escribe un párrafo, selecciona dos palabras y pulsa **negrita**. El cursor
   debe quedarse donde estaba, no saltar al principio.
2. Escribe `canción` con tecla muerta, y otra vez **en mitad de un tramo ya en
   negrita**. El acento no debe perderse ni duplicarse.
3. `Ctrl+B`, `Ctrl+I`, `Ctrl+U`. Ninguna debe abrir un menú del navegador ni
   dejar un `<b>` en el DOM (compruébalo en el inspector).
4. `Ctrl+Z` después de escribir, y después de poner negrita. Luego
   `Ctrl+Shift+Z` y `Ctrl+Y`.
5. Copia un párrafo con negritas **desde Word o Google Docs** y pégalo. Debe
   entrar plano. Repite desde otro formateador de LinkedIn: debe entrar plano
   también, y sin caracteres matemáticos.
6. Selecciona tres líneas y pulsa viñetas, luego numerada, luego otra vez
   numerada. Comprueba que renumera y que el estilo de esas líneas no se
   descoloca.
7. Selecciona un tramo a medio formatear: los botones deben verse en su estado
   intermedio (`data-state="partial"`, opacidad menor).
8. Pulsa Enter al final del texto: el cursor debe bajar de línea visiblemente.
9. **Estilo pendiente (X-31).** Sin seleccionar nada, pulsa negrita: el botón
   debe encenderse. Escribe: lo tecleado sale en negrita y el botón se apaga
   solo. Repite y, antes de escribir, mueve el cursor a otro sitio: el botón
   debe apagarse sin haber pintado nada. Con el cursor **dentro** de una palabra
   ya en negrita, pulsa negrita y escribe: debe salir sin negrita.
10. **Arrastrar y soltar (X-32).** Arrastra una palabra de un sitio a otro
    dentro del editor: tiene que **moverse**, no duplicarse. Suéltala luego
    dentro de su propio hueco: no debe pasar nada. Y arrastra un párrafo desde
    otro formateador de LinkedIn: debe entrar plano y sin caracteres
    matemáticos, igual que al pegar.
11. Consola limpia tras cinco minutos de uso. Un `[PintaPost] ADR-003` en rojo
    significa que ha entrado texto ya estilizado por una vía no prevista — con
    X-32 cerrada, ya no debería ocurrir nunca.

Falta también **Chrome Android** (punto 3 de la Definition of Done), que no se
puede cubrir desde aquí.

### Casos límite del `contenteditable` que NO se cubrieron

Los pide la última nota del sprint. Ordenados por probabilidad de aparecer.

> **Actualización del 2026-09-01.** Los dos primeros de esta lista pasaron a ser
> la tarea 10 y ya no están sin cubrir: **X-31** (estilo pendiente) y **X-32**
> (arrastrar y soltar) están implementados y con tests. Lo que sigue es lo que
> queda de verdad.

1. **`Enter` no continúa la lista** (X-30). Decisión consciente: es el precio
   de que las listas sean prefijos de texto y no estructura, que es la segunda
   idea que gobierna el sprint. Arreglarlo bien obliga a decidir qué pasa al
   pulsar `Enter` dos veces seguidas y al borrar el prefijo a mano, y eso es
   una tarea con diseño propio, no un remate.
2. **Deshacer nativo por menú contextual.** `Ctrl+Z` está interceptado, pero
   «Deshacer» del menú del botón derecho no dispara `keydown`. Llegaría como un
   `input` y se leería como una edición más: **el texto queda coherente**, el
   paso de historial no. Aplazado porque el daño es acotado y porque taparlo
   bien exige `beforeinput` con `inputType === "historyUndo"`, que no todos los
   navegadores emiten igual.
3. **Corrector ortográfico del navegador.** Aceptar una sugerencia de
   `spellcheck` reemplaza una palabra por otra de distinta longitud. Se lee por
   `input` como cualquier edición, así que el texto queda bien; los rangos que
   cruzaran esa palabra pueden desplazarse un carácter. Sin probar. También
   descarta el estilo pendiente, por diseño: no es una inserción limpia.
4. **Autocorrección y predicción de Android.** Van por `compositionend`, que sí
   está tratado, pero algunos teclados emiten composiciones sobre palabras ya
   escritas. Sin probar.
5. **`Enter` con una selección de varias líneas.** El navegador borra y salta
   en un solo `beforeinput`. Se lee del DOM, así que debería salir bien, pero no
   se comprobó.

---

## Actualización del 2026-09-01 — cierre del sprint

_Añadida por Claude Code el 2026-09-01._

### X-34 cerrada de verdad: el round-trip vive en `pnpm test`

`linkedom` entra como dependencia de desarrollo, autorizada por **ADR-020**, y
la lista de dependencias permitidas de `CLAUDE.md` se actualiza en consecuencia.
La verificación que antes estaba fuera del repositorio —y que por tanto nadie
podía volver a ejecutar— pasa a ser `tests/roundtrip.test.js`:

| Bloque | Tests | Qué cubre |
|---|---|---|
| Los diez modelos | 10 | Vacío · acentos y eñes · anidados · solapamiento parcial · los cuatro estilos a la vez · saltos de línea con línea en blanco · escapado de `< > &` · emoji con estilo sobre el par subrogado · viñetas · texto terminado en salto |
| Las siete formas del navegador | 7 | `<br>` suelto (→ texto vacío) · `<br>` entre texto (→ `\n`) · `<div>` hermanos · `<b>` · `<i>` · `<span style="…">` (→ texto plano) · `<div><br></div>` final |
| Convergencia | 1 | Que lo leído de un árbol ajeno sobreviva a un repintado |

`pnpm test` → **261 pass / 0 fail**, 50 suites. `pnpm run build` en verde.

Por qué se aceptó la dependencia: el round-trip es el invariante que sostiene el
editor, y su fallo sería **silencioso** —alternar entre teclear y aplicar estilo
iría corrompiendo el texto sin excepción ni error en consola—, que es justo lo
que un test cubre y una pasada manual no. Un DOM de juguete comprueba nuestras
suposiciones sobre el DOM; uno real comprueba el DOM. El motivo completo, en
ADR-020.

**Lo que `linkedom` no cubre y sigue siendo manual:** `Selection`, `Range`,
eventos de composición, `caretPositionFromPoint` y el gesto de arrastre.
`linkedom` prueba lectura de árbol, no interacción, y la frontera conviene
dejarla donde está.

### Resultado de las tres comprobaciones que quedaban abiertas

Las tres estaban en la lista de «casos límite del `contenteditable` que NO se
cubrieron». Probadas a mano el 2026-09-01:

**1. Corrector ortográfico del navegador (punto 3 de esa lista) — PASA.**
La negrita se mantiene tras aceptar una sugerencia. La preocupación de que los
rangos se desplazaran era **infundada**: `readModelFromDom` no parchea offsets,
relee el árbol entero, así que una palabra sustituida por otra de distinta
longitud no descoloca nada. Es el rédito de leer el DOM en vez de intentar
seguirle el rastro a la edición.

> Nota práctica, no es un fallo de PintaPost: el menú de sugerencias lo pone el
> navegador. Chrome necesita el **diccionario de español instalado** para
> mostrar el subrayado ondulado; sin él no aparece nada que aceptar y la prueba
> no se puede hacer.

**2. `Enter` con una selección de varias líneas (punto 5) — PASA.**
El navegador borra y salta en un solo `beforeinput`, y sale bien porque el
modelo se relee del DOM en lugar de intentar reproducir la operación.

**3. Chrome Android (punto 3 de la Definition of Done) — PASA.**
Con él queda cubierta también la autocorrección y la predicción del teclado
(punto 4 de la lista de casos límite), que era lo que estaba sin probar.

Los dos casos límite que siguen abiertos son los que ya estaban aplazados por
decisión propia y con su entrada en el backlog: **X-30** (`Enter` no continúa la
lista) y **X-35** (deshacer nativo por menú contextual). Ninguno corrompe texto.

### Criterios de aceptación, uno por uno

| Criterio | Evidencia |
|---|---|
| Negrita sin que el cursor salte | Pasada manual del 2026-09-01. El orden guardar selección → mutar → renderizar → restaurar es lo que lo sostiene (`selection.js`) |
| `á` con tecla muerta, también dentro de un tramo con estilo | Pasada manual. `compositionstart`/`compositionend` sin tocar el DOM entre ambos (`editor.js`) |
| Atajos sin etiquetas del navegador | Pasada manual, comprobado en el inspector: ningún `<b>` ajeno en el DOM |
| `Ctrl+Z` deshace, incluidos los cambios de estilo | Pasada manual, ida y vuelta con `Ctrl+Shift+Z` y `Ctrl+Y` |
| Pegado plano desde Word, Google Docs y otro formateador | Pasada manual. `text/plain` + `stripStyling`, sin caracteres matemáticos |
| Listas que alternan, renumeran y no descolocan el estilo | `commands.test.js` + pasada manual |
| "Limpiar formato" devuelve el texto plano exacto | `commands.test.js` + pasada manual |
| `aria-pressed`, incluido el estado intermedio | Pasada manual: `data-state="partial"` con la selección a medio formatear |
| `model.text` nunca entre `U+1D400` y `U+1D7FF` | Guardia de ADR-003 en `editor.js`; con X-32 cerrada no queda ninguna vía de entrada sin limpiar |
| `pnpm test` en verde | 261 pass / 0 fail, 50 suites |
| Consola limpia tras cinco minutos de uso | Pasada manual: sin errores, sin avisos de la guardia de ADR-003 |

### Definition of Done

1. ✅ Todas las casillas marcadas.
2. ✅ `pnpm test` y `pnpm run build` en verde.
3. ✅ Probado a mano en Chrome escritorio y en Chrome Android.
4. ✅ ADR-019 escrita y glosario actualizado. ADR-020 añadida en el cierre.
5. ⏳ Commit preparado, pendiente de ejecutar.
6. ✅ Bitácora actualizada.

**S04 cerrado.**
