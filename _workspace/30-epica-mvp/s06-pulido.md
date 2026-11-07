# S06 — Borradores, vista previa y accesibilidad

**Épica:** C — Lanzamiento MVP
**Estado:** 🔵 En curso
**Historias:** C-01, C-02, C-03, C-04, C-05, C-06

## Objetivo

PintaPost ya funciona. Este sprint decide si alguien **vuelve** a usarlo.

Tres cosas: que no pierdas el trabajo, que veas cómo va a quedar antes de
publicar, y que la herramienta sea honesta sobre lo que hace. Ninguna añade
capacidades nuevas al motor; las tres cambian por completo la sensación de usarlo.

---

## Las dos ideas que gobiernan este sprint

### 1. La vista previa muestra el texto serializado, no el del editor

Es la decisión menos obvia del sprint y la más importante.

El editor muestra el formato con CSS: una `a` en negrita sigue siendo una `a`.
Pero lo que LinkedIn recibe es `𝗮`, un carácter de otro bloque, con otras
proporciones y probablemente de otra fuente. **Ocupa un ancho distinto.**

Si la vista previa renderizara el contenido del editor, el corte de "…ver más"
caería en un sitio distinto al real, y la función perdería exactamente aquello
para lo que sirve. La vista previa debe renderizar **la salida de `serialize()`**,
con la tipografía y el ancho de LinkedIn.

Como efecto secundario, se convierte en la comprobación visual de que lo que se
copia es lo que se espera.

### 2. El aviso honesto es una función, no un descargo legal

El principio de producto número tres dice que PintaPost comunica los costes del
texto Unicode en vez de ocultarlos. Eso no se cumple con una nota gris en el pie
que nadie lee.

El texto Unicode tiene dos costes reales para el usuario: los lectores de
pantalla lo leen mal o no lo leen, y **el buscador de LinkedIn no lo indexa** —así
que poner tu palabra clave principal en negrita te cuesta alcance. Ninguna
herramienta del mercado te lo dice. Decirlo bien, en el momento oportuno y sin
alarmismo, es una ventaja competitiva, no un trámite.

---

## Tareas

### 1. Borradores (C-01)

- [x] `ui/drafts.js`: guardar `{ text, ranges }` en `localStorage` bajo
  `pintapost:draft`, con *debounce* de 1 s desde `pintapost:change`.
- [x] Al cargar la página, si hay borrador y no está vacío, restaurarlo en el
  editor **sin** que parezca que el usuario lo escribió ahora: el panel
  muestra *"Borrador recuperado"* con la fecha.
- [x] Guardar también la marca de tiempo y mostrar *"Guardado hace un momento"*
  / *"hace 5 minutos"*, actualizado cada minuto.
- [x] Acción **"Descartar borrador"** con confirmación. Vacía el editor y borra
  la clave.
- [x] Manejar el fallo de `localStorage`: modo privado de Safari, cuota llena,
  o almacenamiento deshabilitado. Si falla, se muestra un aviso discreto de
  que no se está guardando y **la aplicación sigue funcionando igual**.
  Nunca una excepción sin capturar.
- [x] Guardar solo un borrador. La biblioteca con varios es X-06, aplazada.
- [x] Sustituye el marcador "BORRADORES" del panel lateral (S02).

#### Decisiones tomadas al implementarla

_Añadido por Claude Code el 2026-09-02._

- **Se guarda el modelo, no el HTML ni la cadena serializada.** Guardar el HTML
  ataría el borrador a cómo pintaba `render.js` el día que se escribió, y
  guardar la salida de `serialize()` obligaría a revertir Unicode al
  restaurar, devolviendo al editor caracteres del bloque matemático: justo lo
  que prohíbe ADR-003. Con `{ text, ranges }` restaurar es un `setModel`.
- **Formato con versión (`v: 1`).** Se exige al leer. Si algún día cambia la
  forma del modelo, un borrador viejo se ignora entero en vez de restaurarse a
  medias.
- **`decodeDraft` es estricta con el texto y tolerante con los rangos.** Si el
  texto está bien pero la lista de rangos no, se restaura el texto sin formato:
  perder la negrita es un fastidio, perder el post es otra cosa.
- **Un dato corrupto no se borra.** No restaurarlo ya es la decisión; borrarlo
  además destruiría un texto que todavía se puede rescatar a mano desde las
  herramientas del navegador, y la primera escritura lo sobrescribe igual.
- **Vaciar el editor borra la clave**, en lugar de guardar `{ text: "" }`. Un
  borrador en blanco dejaría el panel diciendo «Guardado hace un momento»
  sobre nada.
- **Volcado en `pagehide` y al ocultarse la página**, además del *debounce* de
  1 s. Sin él se pierde el último segundo de escritura al cerrar la pestaña,
  que es justo el que más duele. `pagehide` y no `beforeunload` porque en iOS
  el segundo no llega nunca. No estaba en el sprint.
- **La confirmación de «Descartar» es en el propio panel, no `confirm()`.** El
  diálogo nativo secuestra la pestaña, el navegador le antepone la URL y en
  móvil aparece pegado al borde superior, lejos del botón recién pulsado.
- **`setupDrafts` va el último en `main.js`.** Restaurar emite
  `pintapost:change`, y el contador y los botones de copiar tienen que estar ya
  escuchando. Si fuera el primero, el editor arrancaría con texto y el contador
  diciendo cero.
- **Guardia `selfInflicted`.** `setModel` emite `pintapost:change` de forma
  síncrona, así que restaurar dispararía un guardado inmediato y el borrador de
  ayer pasaría a estar «guardado hace un momento» sin que el usuario tocara
  una tecla. Con test propio.
- **El aviso de «sin almacenamiento» no se congela.** Una escritura que falla
  por cuota llena puede volver a funcionar en cuanto el usuario borre texto;
  dejar el aviso puesto para siempre sería mentir.
- **Falta la verificación en navegador.** Los 38 tests nuevos corren sobre
  `linkedom`, que no tiene CSS ni layout: el arreglo de `[hidden]` (tarea 8) y
  el aspecto del panel están razonados y compilados, no vistos. Pendiente para
  el paso 3 de la Definition of Done.

### 2. Vista previa de LinkedIn (C-02)

La función más valiosa del producto. Léete la idea 1 antes de empezar.

- [x] `ui/preview.js`: panel que renderiza `serialize(model, opciones)` dentro de
  una tarjeta que imita la publicación de LinkedIn.
- [x] Tipografía y ancho aproximados a los de LinkedIn. Usa la pila de fuentes
  del sistema, no Inter: LinkedIn no usa Inter y aquí queremos parecernos a
  LinkedIn, no a nosotros.
- [x] **Conmutador Móvil / Escritorio.** El ancho del contenedor cambia y con él
  el punto de corte. Son dos respuestas distintas a la misma pregunta.
- [x] **Marcar dónde cae el corte de "…ver más"**: el texto por debajo se atenúa
  y aparece una línea divisoria con la etiqueta *"…ver más"*. Es lo único que
  la vista previa tiene que hacer bien.
- [x] Reutiliza la cabecera de autor simulada que existe en el editor desde el
  S02: muévela aquí, que es su sitio natural, y deja el editor limpio.
- [x] El corte es **por líneas, no por caracteres**: LinkedIn recorta tras un
  número de líneas renderizadas, que depende del ancho. Impleméntalo midiendo
  la altura real del texto renderizado, no contando caracteres.
- [x] Constantes de calibración (líneas visibles en móvil y en escritorio,
  anchos) en un único objeto al principio del archivo, con un comentario que
  diga que son aproximaciones a calibrar contra LinkedIn real (tarea 9).
- [x] Documentar la limitación: si el post lleva imagen o enlace, LinkedIn
  recorta antes. La vista previa cubre el caso de solo texto.
- [x] Sustituye el marcador "VISTA PREVIA" del panel lateral (S02).

#### Decisiones tomadas al implementarla

_Añadido por Claude Code el 2026-09-02._

- **La tarjeta se queda en el panel lateral, decidido por ti.** Con una
  consecuencia que conviene tener presente: el `<aside>` mide 256 px en
  escritorio y la columna de texto del feed ronda los 523 px, así que **el
  corte no se mide donde se ve**.
- **Hay una regla invisible** (`.preview-ruler`) del ancho real del feed, con la
  tipografía y el interlineado de LinkedIn, donde se vuelca el texto
  serializado y se busca el offset del corte. Ese offset es una propiedad del
  ancho de LinkedIn, no del nuestro, así que sigue siendo correcto cuando la
  tarjeta estrecha lo pinta: **las palabras que sobreviven al corte son las
  mismas**, aunque el renglón donde caen sea otro. En móvil, donde el panel
  ocupa el ancho completo, la tarjeta sí alcanza el ancho real y la vista
  previa es exacta también en lo visual.
- **La regla vive fuera del `<aside>`**, al final del `<body>`. Dentro del
  `<details>` del panel, plegarlo en móvil la dejaría sin layout y
  `getBoundingClientRect()` devolvería cero. Va en `position: fixed` para que
  ni el `overflow-y` del panel la recorte ni su ancho —mayor que un teléfono en
  modo Escritorio— le añada scroll horizontal a nadie, y con
  `visibility: hidden`, que conserva las cajas; `display: none` no serviría.
- **Las constantes de calibración quedaron en dos bloques, no en uno.** El
  sprint pedía un solo objeto, pero las anchuras son longitudes y ADR-015 manda
  que toda longitud se declare en `styles.css`. Así que:
  - **anchuras** → `:root` de `styles.css`: `--preview-width-mobile: 358px` y
    `--preview-width-desktop: 523px`.
  - **líneas visibles** → objeto `LINKEDIN` al principio de `preview.js`, hoy 3
    y 3.

  Los dos bloques llevan el aviso de que son aproximaciones y se apuntan
  mutuamente. **Al calibrar (tarea 9) hay que tocar los dos.**
- **La búsqueda binaria se extrajo a `lastOffsetThatFits`,** pura y exportada.
  Es la lógica más fácil de equivocar del archivo —un `≤` por un `<` y el corte
  se va una palabra— y dentro del código que mide no habría forma de probarla.
  Tiene un test exhaustivo sobre las 3.001 fronteras posibles.
- **`snapToGrapheme` antes de cortar.** El texto medido es el ya serializado:
  una `a` en negrita son 2 unidades UTF-16 y una `á` en negrita son 3. Sin
  retroceder a frontera de grafema, el corte parte el par subrogado —dos
  caracteres de reemplazo en pantalla— o deja el acento huérfano encabezando el
  bloque atenuado. Con test para los dos casos y para emoji compuesto.
- **El salto de línea que cierra la parte visible no se pinta.** Es el final de
  la última línea visible y la divisoria ya lo representa; devolverlo abriría
  el bloque atenuado con un renglón en blanco. Dos saltos seguidos sí se
  respetan: son un párrafo en blanco puesto a propósito.
- **Arranca en Móvil.** Es el corte más severo y la mayoría del tráfico de
  LinkedIn; enseñar primero el caso estrecho es el consejo conservador. El modo
  **no se recuerda** entre sesiones: cabría en ADR-017 como preferencia de
  interfaz, pero el sprint no lo pedía. Anotado en el backlog.
- **Un resumen bajo la tarjeta nombra la última palabra visible**
  («Se corta tras «raro».»). Es exactamente el dato que la tarea 9 manda anotar
  del feed real, así que calibrar se convierte en comparar dos frases.
- **Sin layout no se inventa un corte.** Si la medición devuelve cero —pestaña
  en segundo plano, panel plegado, un `display: none` heredado— se pinta el
  texto entero en vez de cortar por un sitio al azar. Con test.
- **`measureCut` no tiene test y no puede tenerlo.** `linkedom` no trae motor de
  layout, que es justo lo único que esa función usa. Quitada la búsqueda
  binaria, lo que le queda son tres llamadas a la API del navegador. Su
  verificación es la tarea 9, a mano y contra el feed.

### 3. Accesibilidad (C-03)

- [ ] Recorrer toda la interfaz con teclado: orden lógico, foco visible, ninguna
  trampa. Incluye el nuevo panel de vista previa.
- [ ] Probar con un lector de pantalla real: NVDA en Windows o VoiceOver en Mac.
  Comprobar que la barra de herramientas se anuncia como tal, que los botones
  dicen su estado (`aria-pressed`), y que el contador se anuncia al cambiar
  sin interrumpir la escritura (`aria-live="polite"`).
- [ ] El editor debe anunciarse como campo de texto multilínea con su etiqueta.
- [ ] La confirmación de copiado debe llegar al lector de pantalla.
- [ ] Lighthouse Accesibilidad ≥ 95 en móvil **y** en escritorio.
- [ ] Verificar contraste AA de los elementos nuevos, no solo de los heredados.

### 4. Aviso honesto sobre el texto Unicode (C-04)

- [ ] Un bloque discreto junto a los botones de copiar, plegado por defecto,
  con un enlace tipo *"¿Qué implica el formato?"* que lo despliega.
- [ ] Contenido, en lenguaje llano y sin alarmismo:
  - Los lectores de pantalla leen mal el texto con formato Unicode. Si tu
  audiencia incluye personas con discapacidad visual, considera usar
  "Copiar sin formato".
  - El buscador de LinkedIn no encuentra palabras con formato. Evita poner
  en negrita tu palabra clave principal.
  - Los hashtags y menciones se copian sin formato a propósito, para que
  sigan funcionando como enlaces.
- [ ] Ese tercer punto conecta con la señal visual del S05: si el usuario ve que
  su hashtag no cambia y aquí encuentra el porqué, la app se explica sola.
- [ ] **No** un modal, **no** un banner permanente, **no** un icono de alerta.
  Una línea que se puede desplegar.

### 5. Rendimiento (C-05)

- [ ] Lighthouse Rendimiento ≥ 95 en móvil con red 4G simulada.
- [ ] LCP < 1,5 s.
- [ ] Peso total transferido < 120 KB comprimido. Mídelo de verdad en la pestaña
  Red, no lo estimes.
- [ ] **Revisa los subconjuntos de fuente.** Hoy se copian seis archivos
  (~300 KB en disco). El vietnamita no sirve para español. El `latin-ext`
  tampoco: el subconjunto `latin` ya cubre `U+00C0–00FF`, que incluye
  á é í ó ú ñ ü ¿ ¡. Y la variante itálica (~52 KB) entra en cuanto el editor
  renderiza un `<em>`, que ahora ya ocurre. Decide qué se queda y anota el
  motivo; si quitas `latin-ext`, comprueba antes que ningún texto de la
  interfaz lo necesita.
- [ ] Comprobar que serializar en cada pulsación sobre 3.000 caracteres no
  produce retardo perceptible (era X-27). Mide antes de optimizar.

### 6. Política de privacidad (C-06)

- [ ] `public/privacidad.html`, con el mismo diseño que el resto del sitio.
- [ ] Contenido veraz y en español llano:
  - No hay cuentas ni registro.
  - El texto **nunca sale de tu navegador**. No hay servidor que lo reciba.
  - Los borradores y las preferencias se guardan en `localStorage`, en tu
  dispositivo, y puedes borrarlos desde la propia aplicación.
  - No se usan cookies ni rastreadores de terceros.
  - Fecha de última actualización.
- [ ] Enlazarla desde el pie del panel lateral, donde el S02 dejó el marcador.
- [ ] **Deja escrito en el propio archivo** que habrá que revisarla en la etapa 2:
  el generador de ideas enviará el tema seleccionado a Google, y eso hay que
  declararlo. Un comentario HTML basta.

### 7. Página 404

Hallazgo de la auditoría: `wrangler.jsonc` declara `not_found_handling:
"404-page"` pero **no existe `public/404.html`**, así que hoy una URL inexistente
devuelve una respuesta genérica.

- [ ] Crear `public/404.html` con el diseño del sitio, un mensaje corto y un
  enlace de vuelta al editor. Que respete el tema claro/oscuro.

### 8. Arreglos heredados

- [x] **`hidden` no ocultaba nada.** _Añadida por Claude Code el 2026-09-02._
  Preflight emite `[hidden]:where(:not([hidden=until-found]))` con
  especificidad (0,1,0) —la misma que cualquier clase de componente— y sale
  en el byte 4.700 del CSS compilado, mucho antes que los componentes. Así que
  `.manual-copy { @apply flex }` ganaba por orden de aparición y **el bloque de
  copia manual del S05 se veía siempre**, con `hidden` puesto y `clipboard.js`
  alternando la propiedad correcta. Es una trampa silenciosa: el marcado dice
  una cosa y en pantalla no pasa nada. Cerrado para todo el proyecto con un
  `[hidden] { display: none }` al final de `styles.css`, sin `!important`: le
  basta con ser la última regla del archivo. Salió al escribir la tarea 1,
  cuyos elementos caían en la misma trampa.
- [ ] El subrayado del editor cruza los hashtags aunque al copiar salgan sin
  marca. Añadir `text-decoration: none` al tramo protegido para que lo que se
  ve coincida con lo que se copia.
- [ ] Revisar el backlog y cerrar lo que ya no aplique.

### 9. Calibración de la vista previa — **TAREA MANUAL**

- [ ] Escribir un post de prueba de unas 15 líneas con formato variado y copiarlo
  a LinkedIn.
- [ ] Publicarlo con visibilidad **"Solo yo"**.
- [ ] En el feed de escritorio, anotar **qué palabra exacta** es la última visible
  antes del "…ver más".
- [ ] Repetir en la app móvil.
- [ ] Ajustar las constantes de `preview.js` para que el corte simulado coincida.
- [ ] Borrar el post.
- [ ] Repetir con un segundo texto de longitud distinta para confirmar.

### 10. Tests

- [x] `drafts.test.js`: serializar y restaurar el modelo, borrador vacío,
  `localStorage` que lanza excepción, y datos corruptos en la clave (que no
  deben romper el arranque).
- [x] `preview.test.js`: la parte pura del cálculo del corte, con `linkedom`.
- [ ] Los 348 tests existentes deben seguir en verde.

---

## Criterios de aceptación

- [ ] Cerrar y reabrir la pestaña conserva el texto **y su formato**.
- [ ] La vista previa muestra el texto tal como LinkedIn lo recibirá, y el corte
  de "…ver más" coincide con el real dentro de una línea de margen, en móvil
  y en escritorio.
- [ ] Lighthouse ≥ 95 en Accesibilidad y Rendimiento, en móvil y escritorio.
- [ ] Peso transferido < 120 KB comprimido.
- [ ] Navegación completa por teclado, verificada con un lector de pantalla real.
- [ ] El aviso sobre el texto Unicode existe, se entiende y no estorba.
- [ ] Existe la política de privacidad, es veraz y está enlazada.
- [ ] Una URL inexistente devuelve un 404 con el diseño del sitio.
- [ ] `localStorage` deshabilitado no rompe la aplicación.
- [ ] `pnpm test` en verde.

## Definition of Done

1. Todas las casillas marcadas, salvo la tarea 9 si la calibración queda
   pendiente, que debe anotarse.
2. `pnpm test` y `pnpm run build` en verde.
3. Verificado en Chrome escritorio y Chrome Android.
4. Commit en Conventional Commits.
5. Bitácora actualizada.

---

## Notas para Claude Code

- **No toques nada de `format/` ni de `editor/`** salvo el arreglo del subrayado
  sobre hashtags de la tarea 8. Las épicas A y B están cerradas.
- La vista previa consume `serialize()`; **no la reimplementes** ni conviertas
  nada por tu cuenta.
- Los nuevos módulos van en `ui/` y se enganchan al evento `pintapost:change`,
  igual que el contador. Nada de acoplarlos al editor por dentro.
- `localStorage` está permitido aquí por ADR-017: borradores y preferencias.
- El aviso de la tarea 4 y la política de la tarea 6 los redactas tú, pero
  **muéstramelos antes de darlos por buenos**. Es texto de cara al usuario y
  quiero revisar el tono.
- Al terminar, dime qué no pudiste calibrar de la vista previa y por qué.

## Pendientes para la consola web

Ninguno. El despliegue es del S07.