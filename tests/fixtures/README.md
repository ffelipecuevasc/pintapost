# Fixtures de verificación manual — S03

Estos dos archivos no los usa `pnpm test`. Son el material para las tareas 5 y
6 del sprint, que se ejecutan a mano pegando texto en LinkedIn.

Ambos están en UTF-8 sin BOM y con saltos de línea LF. Pégalos tal cual: si el
editor los reescribe, se pierde justamente lo que se quiere medir.

---

## `cadena-de-prueba.txt` — verificación visual cross-device (tarea 5)

Un solo bloque, ya convertido a Unicode, con doce puntos etiquetados. Pégalo
completo en el editor de LinkedIn **sin publicar** y compruébalo en los cinco
entornos objetivo: Windows/Chrome, macOS/Safari, Android/Chrome, iOS/Safari y
**la app móvil de LinkedIn**.

Los puntos 1 a 9 son los que pide el sprint, en su orden. Los puntos 10 a 12
son extras que caben en el mismo pegado y no cuestan una prueba aparte.

Qué mirar, por orden de importancia:

1. **Puntos 3, 4 y 11 — la alineación de la tilde.** Es el riesgo aceptado en
   ADR-005: la posición de la marca depende de las tablas de *mark positioning*
   de la fuente, afinadas para latín normal, no para letras matemáticas. Si en
   algún entorno la tilde sale desplazada, corrida a un lado o pisando la letra,
   anótalo con captura. El punto 11 es el peor caso: tilde y subrayado apilados
   sobre la misma letra.
2. **Punto 9 — los emojis.** Deben verse enteros. Una familia partida en tres
   personas sueltas o una bandera convertida en dos letras significa que algo
   rompió la secuencia.
3. **Puntos 1, 2, 6 y 10 — los bloques completos.** Ninguna letra debe salir
   como cuadro vacío ni como carácter distinto al resto de su línea.
4. **Puntos 7 y 8 — subrayado y tachado.** Comprueba si la línea sale continua
   sobre los espacios o si se corta entre palabras; el resultado decide X-21.
5. **Punto 12 — el hashtag y la mención.** Van a propósito sin formato: deben
   seguir siendo enlaces azules de LinkedIn (ADR-013).

Anota el resultado por entorno en `_workspace/90-manual/`.

---

## `contador-1600.txt` — cómo cuenta LinkedIn (tarea 6, B-05)

Exactamente **1.600 caracteres**, todos convertibles a negrita: solo `a–z`,
`A–Z` y dígitos. Sin espacios, sin tildes y sin salto de línea final, porque
cualquier carácter no convertible ensuciaría la aritmética.

El procedimiento:

1. Pega el archivo en LinkedIn **sin formato** y anota el contador.
2. Pégalo **todo en negrita** y anota el contador.

Y la lectura del resultado:

| Si el segundo número dice | LinkedIn cuenta | Consecuencia |
|---|---|---|
| **3.200** | unidades UTF-16 | El contador dual del S05 es imprescindible: un post en negrita agota el límite a la mitad |
| **1.600** | codepoints o grafemas | El contador dual sigue siendo útil, pero deja de ser crítico |
| otra cosa | algo distinto a lo previsto | Anótalo tal cual; ninguna de las dos hipótesis se sostiene |

Los tres números salen de `count()` sobre el archivo ya convertido:
`{ utf16: 3200, codepoints: 1600, graphemes: 1600 }`. La primera medida es la
única que se separa, y por eso el experimento distingue.

El resultado se registra como nota en ADR-012, que hoy lo tiene marcado como
pendiente.
