# S05 — Serialización, portapapeles y contador

**Épica:** B — Motor de formato
**Estado:** 🟢 Cerrado (2026-09-01)
**Historias:** B-13, B-14, B-15, B-16, B-17

## Objetivo

El sprint que cierra el círculo. Hasta ahora hay un motor Unicode que nadie
llama y un editor que muestra estilo con CSS. Aquí se unen: el usuario pulsa
**Copiar para LinkedIn** y obtiene la cadena que sobrevive al pegado.

Al terminar, PintaPost es un producto terminado. Falta pulirlo y publicarlo
(épica C), pero funciona de principio a fin.

---

## Las tres ideas que gobiernan este sprint

### 1. Una sola segmentación para pintar y para copiar

`render.js` ya tiene una función `segments()` privada que parte el texto en
tramos con conjunto de estilos constante. El serializador necesita exactamente lo
mismo.

**Extráela a un módulo compartido.** Si `render` y `serialize` calculan los tramos
por separado, tarde o temprano divergen, y el usuario copia algo distinto de lo
que ve. Con una sola función eso es imposible por construcción.

### 2. Los hashtags se protegen al copiar, no en el modelo

Podría parecer más limpio marcar los hashtags en el modelo y no dejar que reciban
estilo nunca. Es peor: si el usuario escribe `#Marketing` y luego borra la
almohadilla, deja de ser un hashtag, y el modelo tendría que enterarse.

La detección se hace **sobre `model.text`, en el momento de serializar y de
pintar**. Es una función pura del texto actual, sin estado que mantener
sincronizado.

### 3. En el portapapeles no se espera a nada

Safari en iOS pierde el contexto del gesto del usuario si hay un `await` antes de
escribir en el portapapeles, y la escritura falla **en silencio** (H-17). La
serialización es síncrona, así que basta con no romper esa propiedad:

```js
boton.addEventListener("click", () => {
  const texto = serialize(modelo, opciones);   // síncrono, sin await
  navigator.clipboard.writeText(texto).then(ok).catch(plan_b);
});
```

Nunca `await` antes de `writeText`. Si algún día la serialización se vuelve
asíncrona, hay que pasar una Promise a `ClipboardItem` en lugar de esperar.

---

## Estructura al cerrar el sprint

```
public/static/js/
├── editor/
│   ├── segments.js       ← NUEVO: extraído de render.js
│   ├── model.js
│   ├── render.js         usa segments.js
│   ├── selection.js
│   ├── commands.js
│   ├── history.js
│   └── editor.js
├── export/
│   ├── protect.js        ← NUEVO: hashtags y menciones
│   ├── serialize.js      ← NUEVO: modelo → cadena Unicode
│   └── clipboard.js      ← NUEVO: copiado con sus alternativas
├── ui/
│   ├── counter.js        ← NUEVO
│   └── settings.js       ← NUEVO: casilla de compatibilidad
└── format/  (sin tocar)
tests/
├── segments.test.js
├── protect.test.js
└── serialize.test.js
```

---

## Tareas

### 1. Segmentación compartida (`segments.js`)

- [x] Mover `segments()` desde `render.js` a `editor/segments.js` y exportarla.
- [x] Firma: `segments(length, ranges, protectedRanges = [])` → lista de
  `{ start, end, styles: Set|Array, protected: boolean }`.
- [x] Un tramo protegido se corta como cualquier otro límite, y sale marcado.
- [x] `render.js` pasa a importarla. Sus tests deben seguir en verde sin cambios.

### 2. Protección de hashtags y menciones (`protect.js`, B-17, ADR-013)

- [x] `findProtected(text)` → lista de `{ start, end }` en unidades UTF-16.
- [x] Reconoce `#etiqueta` y `@mención`: el símbolo debe ir al principio del
  texto o precedido de un espacio o salto de línea, y le siguen letras,
  números, guiones bajos o guiones. Usa `\p{L}` y `\p{N}` con la bandera `u`
  para que `#Diseño` y `#Año2026` funcionen.
- [x] **No** debe confundirse con un correo: en `hola@ejemplo.com` la arroba va
  precedida de letra, así que no es una mención. Escríbele el test.
- [x] Un `#` o `@` suelto, sin texto detrás, no es nada.
- [x] En `serialize`, los tramos protegidos se emiten **tal cual**, sin aplicar
  ningún estilo, aunque el modelo diga que están en negrita.
- [x] En `render`, se pintan con una señal visual discreta —color distinto y
  `title` explicativo— para que el usuario entienda por qué su hashtag no se
  pone en negrita. Nada de iconos ni avisos modales: una pista, no una
  interrupción.

### 3. Serializador (`serialize.js`, B-13)

- [x] `serialize(model, { styleCombining = true } = {})` → cadena.
- [x] Algoritmo: obtener los tramos con `segments(model.text.length,
      model.ranges, findProtected(model.text))`, y para cada uno llamar a
  `toStyled(trozo, estilo)` de `unicode.js`, salvo los protegidos, que van
  literales.
- [x] Función **pura**: no toca el DOM ni lee configuración global. Las opciones
  llegan por parámetro.
- [x] **No modifica `unicode.js`.** Está cerrado desde el S03.
- [x] Caso a cuidar: un salto de línea dentro de un tramo subrayado no debe
  recibir la marca combinable, o el subrayado se arrastra al renglón
  siguiente en algunos clientes.

### 4. Contador (`counter.js`, B-16, ADR-012)

Sabemos por la verificación empírica que **LinkedIn cuenta unidades UTF-16**, así
que la cifra que manda no es la que el usuario ve.

- [x] Dos números, con el segundo como protagonista:
  ```
  1.240 caracteres  ·  1.890 / 3.000 en LinkedIn
  ```
  El primero son grafemas de `model.text` (lo que el usuario percibe). El
  segundo es `serialize(...).length` (lo que LinkedIn cuenta).
- [x] Tres estados visuales: normal, **aviso a partir de 2.700** (90 %), y
  **error por encima de 3.000**. El aviso llega antes del límite, no al
  cruzarlo: el objetivo es que el usuario reaccione mientras aún escribe.
- [x] En estado de aviso, una línea que explique la causa, porque el usuario no
  puede adivinarla: *"El formato ocupa espacio: tu texto usa 1.890 de los
  3.000 caracteres de LinkedIn."*
- [x] Se recalcula escuchando el evento `pintapost:change` del editor, con
  *debounce* de unos 150 ms. No acoples el contador al editor por dentro.
- [x] Sustituye el marcador de posición "CARACTERES" del panel lateral (S02).

### 5. Copiado (`clipboard.js`, B-13, B-14)

- [x] `copyText(texto)` → promesa. Camino principal
  `navigator.clipboard.writeText`.
- [x] Alternativa 1: `<textarea>` temporal fuera de pantalla +
  `document.execCommand("copy")`. Está obsoleto pero funciona donde la API
  moderna no.
- [x] Alternativa 2: mostrar el texto en un campo seleccionable con el mensaje
  *"Mantén pulsado y elige Copiar"*. **Nunca un error sin salida.**
- [x] Conectar el botón "Copiar para LinkedIn", que ya existe en la interfaz.
- [x] Confirmación visible: el botón cambia a "¡Copiado!" con el icono `check`
  durante dos segundos y vuelve a su estado. Añade una región `aria-live`
  para que un lector de pantalla lo anuncie.
- [x] Botón deshabilitado con el editor vacío.
- [x] **Ni un `await` antes de `writeText`.** Ver la idea 3.

### 6. Copiar como texto plano (B-15)

- [x] Segundo botón, secundario, junto al principal: **"Copiar sin formato"**.
- [x] Copia `model.text` tal cual: el texto original, sin caracteres matemáticos.
- [x] Una línea de ayuda bajo los botones explicando para qué sirve: el texto
  Unicode no lo leen bien los lectores de pantalla ni lo indexa el buscador
  de LinkedIn. El aviso completo de accesibilidad es del S06; aquí basta con
  que la opción exista y se entienda.

### 7. Casilla de máxima compatibilidad (ADR-018)

- [x] En el panel lateral: **"Máxima compatibilidad"**, con la explicación
  *"No dar formato a las letras con tilde. Se ven mejor en algunos
  navegadores y ocupan menos caracteres."*
- [x] Al activarla, `serialize` se llama con `styleCombining: false`.
- [x] **Muestra el ahorro en el momento**, junto a la casilla: *"Ahorras 240
  caracteres"*. Es lo que convierte un ajuste técnico en algo que el usuario
  entiende.
- [x] Persistir en `localStorage` bajo `pintapost:compat` (permitido por
  ADR-017). Por defecto **desactivada**, según ADR-018.
- [x] Sustituye nada del panel: es una sección nueva.

### 8. Tests

- [x] `segments.test.js`: los tests de segmentación que hoy viven en
  `render.test.js`, más el corte por tramos protegidos.
- [x] `protect.test.js`: `#etiqueta`, `@mención`, `#Diseño`, `#Año2026`,
  correos que no son menciones, símbolos sueltos, hashtag al principio del
  texto, dos seguidos, y hashtag dentro de un tramo en negrita.
- [x] `serialize.test.js`:
  - Un modelo sin estilos devuelve el texto idéntico.
  - Negrita parcial afecta solo a su tramo.
  - Estilos solapados producen negrita-cursiva en la intersección.
  - Un hashtag dentro de un tramo en negrita sale **sin** formato.
  - `styleCombining: false` deja las vocales acentuadas en plano y el
  resultado ocupa menos unidades UTF-16.
  - El salto de línea no arrastra la marca de subrayado.
  - `stripStyling(serialize(m)) === m.text` para un corpus en español.
- [x] Ese último test es el cierre del círculo: lo que sale se puede volver a
  limpiar y da exactamente lo que había.

### 9. Verificación manual

- [x] En escritorio: escribir un post real, dar formato, copiar, pegar en
  LinkedIn y comprobar que se ve igual que en el editor.
- [x] Comprobar que un hashtag formateado **sigue siendo un enlace azul** en
  LinkedIn. Es el diferenciador de ADR-013 y hay que verlo funcionar.
- [x] Comprobar que el contador coincide con lo que dice LinkedIn: escribir hasta
  que PintaPost marque 3.000 y confirmar que LinkedIn no se queja.
- [x] En Chrome Android, copiar y pegar en la app de LinkedIn.
- [x] En Safari iOS, lo mismo. Es el entorno con el fallo silencioso conocido.

> ⚠️ **La API del portapapeles exige contexto seguro.** Por `http://` en la red
> local no funciona, así que la prueba en móvil no vale contra
> `http://192.168.x.x:8788`. Arranca el servidor con
> `npx wrangler dev --ip 0.0.0.0 --local-protocol https` y acepta el aviso de
> certificado en el móvil. Si no hay manera, esta comprobación se traslada al
> S07, sobre el sitio ya desplegado, y se anota como pendiente.

> ✅ **Verificada por Felipe el 2026-09-01**, los cinco ítems con resultado
> correcto, incluidos Chrome Android y Safari iOS. El fallo silencioso de H-17
> **no se reprodujo**: la regla de no poner ningún `await` antes de `writeText`
> hizo su trabajo. No queda ningún caso de portapapeles sin probar, así que no
> hay nada que trasladar al S07.
>
> _Resultado registrado por Claude Code el 2026-09-01._

---

## Criterios de aceptación

- [x] Copiar y pegar en LinkedIn produce exactamente el formato que se ve en el
  editor.
- [x] Un hashtag dentro de un tramo en negrita se copia sin formato y sigue
  funcionando como enlace en LinkedIn.
- [x] El contador muestra las dos cifras y avisa a partir de 2.700.
- [x] La casilla de compatibilidad cambia el resultado y muestra el ahorro.
- [x] "Copiar sin formato" devuelve el texto original sin caracteres matemáticos.
- [x] El copiado funciona en Chrome escritorio, Chrome Android y Safari iOS, o
  queda documentado por qué no se pudo probar.
- [x] Nunca aparece un error de copiado sin alternativa para el usuario.
- [x] `stripStyling(serialize(m)) === m.text` para todo el corpus.
- [x] `pnpm test` en verde y `render.test.js` sigue pasando tras la extracción.

## Definition of Done

1. Todas las casillas marcadas.
2. `pnpm test` y `pnpm run build` en verde.
3. Pegado real en LinkedIn verificado, no solo el portapapeles del sistema.
4. Commit en Conventional Commits.
5. Bitácora actualizada.
6. **La épica B queda cerrada.** Actualiza su `_epica.md` y el README.

---

## Notas para Claude Code

- **No toques `unicode.js`, `blocks.js` ni `counting.js`.** Cerrados desde el S03.
- **No cambies el comportamiento del editor.** El S04 está cerrado y verificado.
  La única modificación permitida en `render.js` es importar `segments.js` en
  lugar de definirla, y pintar los tramos protegidos.
- El serializador es **puro**: recibe modelo y opciones, devuelve cadena. Toda la
  lectura de configuración y de `localStorage` vive en `settings.js`.
- El contador y la casilla se enganchan al evento `pintapost:change`. No metas
  llamadas al contador dentro de `editor.js`.
- Cuidado con el rendimiento: serializar en cada pulsación sobre 3.000 caracteres
  es lo que anticipaba X-27. Con *debounce* debería bastar; si no, mídelo antes
  de optimizar.
- Al terminar, dime qué casos de portapapeles NO pudiste probar y por qué.

## Pendientes para la consola web

Ninguno. La prueba en móvil con HTTPS local puede requerir aceptar un certificado
autofirmado, pero no toca ninguna consola.
---

## Decisiones tomadas sobre la marcha (tareas 1 a 8)

_Añadida por Claude Code el 2026-09-01._

Cuatro cosas que el sprint no fijaba y que hubo que decidir. Ninguna cambia el
alcance; las tres primeras conviene que queden por escrito porque afectan a
código que ya estaba cerrado.

### 1. El `<span>` del hashtag va DENTRO de `<strong>`, no en su lugar

El sprint pedía pintar los tramos protegidos con una señal visual. Lo natural
era no emitir las etiquetas de estilo sobre ellos —así se vería exactamente lo
que se va a copiar—, y eso **rompe el invariante del S04**:
`readModelFromDom(render(m))` dejaría de devolver `m`, porque al leer el DOM de
vuelta se perdería el rango de negrita del hashtag. El usuario vería
desaparecer la negrita de toda la línea al pulsar cualquier botón de la barra.

Se emite `<strong><span class="protected">#tag</span></strong>` y es `styles.css`
quien neutraliza la negrita y la cursiva heredadas. El modelo conserva la
intención, el editor enseña la verdad y el invariante sigue en pie. Hay cinco
tests nuevos en `roundtrip.test.js` que lo vigilan.

**Límite conocido:** `text-decoration` de un ancestro se dibuja sobre todos sus
descendientes y no se puede cancelar desde dentro, así que la línea de `<u>` y
`<s>` sigue cruzando el hashtag. Cancelarla exigiría `display: inline-block`,
que dentro de un `contenteditable` trae problemas al colocar el cursor en los
bordes, y no parecía un intercambio que valiera la pena por una pista visual.

### 2. `toLocaleString("es-ES")` no sirve para este contador

En español, un número de **cuatro cifras** no lleva separador de miles: CLDR le
asigna `minimumGroupingDigits: 2`, así que `(2800).toLocaleString("es-ES")`
devuelve `2800`. Es correcto según la norma y es exactamente el rango entero de
este contador, cuyo techo son 3.000: el punto no habría aparecido nunca y el
formato del sprint —`1.890 / 3.000`— no se habría cumplido.

Se añadió `public/static/js/ui/format.js`, que agrupa de tres en tres con una
expresión regular. Además de resolverlo, deja el formato idéntico en todos los
navegadores sin depender de qué datos de ICU traiga el motor. Tiene su propio
`tests/format.test.js`.

### 3. La región `aria-live` del contador anuncia estados, no cifras

El contador se reescribe en cada ráfaga de escritura. Si la región en vivo
llevara la cifra, el lector de pantalla la repetiría cada 150 ms y el usuario
acabaría ignorándola justo el día que importa. El texto visible lleva los
números siempre actualizados; al lector solo se le habla cuando el **estado**
cambia (normal → aviso → error).

### 4. Los tests de segmentación se añadieron, no se movieron

El sprint decía «los tests de segmentación que hoy viven en `render.test.js`».
Revisado el archivo, allí no hay tests de segmentación como tales: hay tests de
**marcado**, que ejercitan las fronteras de rebote comprobando el HTML. Siguen
siendo válidos y siguen pasando sin tocarlos, que es lo que pedía el sprint.
`segments.test.js` prueba las fronteras directamente sobre la función, que es
otra cosa y cubre además el corte por tramos protegidos.

## Resultado al cerrar el sprint

_Sección reescrita por Claude Code el 2026-09-01, al recibir el resultado de la
tarea 9. Antes decía que la verificación manual estaba pendiente._

| Comprobación | Resultado |
|---|---|
| `pnpm test` | **348 pass / 0 fail**, 68 suites (+87 sobre el S04) |
| `pnpm run build` | verde |
| `render.test.js` tras la extracción | 34/34, sin tocar el archivo |
| Round-trip DOM real, con hashtags | 23/23 |
| `stripStyling(serialize(m)) === m.text` | 12 frases × 9 combinaciones, en los dos modos |
| CSS con gzip | 6.125 b (presupuesto: 8 KB) |
| Verificación manual (tarea 9) | **5 de 5**, por Felipe |
| Casillas del sprint | todas |
| Criterios de aceptación | **9 de 9** |

**Lo que confirma la tarea 9,** y que ningún test podía confirmar:

- El formato **sobrevive al pegado real** en LinkedIn y se ve igual que en el
  editor. Es la hipótesis central de todo el producto, y hasta ahora era una
  suposición apoyada en el S03.
- Un hashtag dentro de un tramo en negrita **sigue siendo un enlace azul**. Es
  el diferenciador de ADR-013 y la razón de que la detección se haga al
  serializar; ahora está visto funcionar.
- El contador **coincide con el de LinkedIn** hasta los 3.000. La hipótesis de
  ADR-012 —que LinkedIn cuenta unidades UTF-16— queda confirmada de punta a
  punta, no solo en el experimento aislado del S03.
- **El fallo silencioso de H-17 no se reprodujo** en Safari de iOS. La regla de
  no poner ningún `await` antes de `writeText` era la mitigación correcta.

**Sprint cerrado y épica B cerrada.** Queda el commit, que es el último paso de
la Definition of Done.
