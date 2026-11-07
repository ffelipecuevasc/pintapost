# Verificación visual cross-device — S03, tarea 5

Resultado de pegar `tests/fixtures/cadena-de-prueba.txt` en el editor de
LinkedIn, sin publicar, en los cinco entornos objetivo. Fecha: **2026-08-31**.

Las columnas son los tres puntos que el sprint marcaba como críticos:

- **Puntos 3-4** — vocales acentuadas, diéresis y eñe, en negrita y en cursiva.
- **Punto 11** — peor caso: tilde y subrayado apilados sobre la misma letra.
- **Emojis** — punto 9: 😀, familia, bandera, pulgar con tono y tecla.

---

## Resultado por entorno

| Entorno | Líneas 3-4 | Línea 11 | Emojis |
|---|---|---|---|
| App LinkedIn Android | ✅ | ✅ | ✅ |
| App LinkedIn iOS | ✅ | ✅ | ✅ |
| Chrome Android | ✅ | ✅ | ✅ |
| Safari iPhone | ✅ | ✅ | ✅ |
| Chrome escritorio | ⚠️ | ⚠️ | ✅ |

Cuatro de cinco entornos limpios. El único que falla es Chrome en Windows.

---

## Hallazgo: el acento agudo se desplaza en Chrome de escritorio

En Chrome/Windows, el acento agudo (`U+0301`) colocado sobre una letra del
bloque matemático **se desplaza a la derecha y aterriza sobre la consonante
siguiente**. El punto 5 de la cadena de prueba se lee así:

```
esperado   ¿Cómo estás?
observado  ¿Coḿo estaś?
```

Lo que sí funciona en ese mismo entorno:

- La **virgulilla** (`U+0303`, ñ) se posiciona bien.
- La **diéresis** (`U+0308`, ü) se posiciona bien.
- Los **emojis** salen enteros, incluidas la familia con ZWJ, la bandera y el
  pulgar con tono de piel.

Es decir: el problema es específico del acento agudo, no de las marcas
combinables en general.

### Un detalle contraintuitivo

**El punto 11 se ve mejor que el punto 5**, y el 11 es el que el sprint había
marcado como peor caso. La diferencia entre los dos es que el 11 lleva además
subrayado (`U+0332`). Añadir una segunda marca combinable parece reanclar la
pila de diacríticas sobre la letra correcta.

No sirve como solución —nadie va a subrayar un texto para que las tildes se
coloquen bien— pero apunta a que el fallo está en el *mark positioning* de la
fuente y no en el manejo del texto por parte de LinkedIn.

### Lectura

Es exactamente **el riesgo que ADR-005 dejó aceptado**, materializado en uno de
los cinco entornos. La ADR lo preveía en «Android/Noto antiguos»; ha aparecido
en el sitio contrario, Chrome de escritorio, y Android está limpio.

No invalida la técnica de composición: cuatro de cinco entornos la renderizan
bien, y el quinto la renderiza mal solo para una de las tres marcas.

---

## Consecuencia

Se abre **ADR-018**: `toStyled` gana una opción `styleCombining` que, puesta a
`false`, deja sin estilizar cualquier letra que lleve diacrítica. El defecto
sigue siendo el estilo compuesto (opción A); la casilla que expone la
alternativa en la interfaz es del S05, junto al contador.

---

## Pendiente

- [ ] **Comprobar cómo se ve en el feed publicado, no solo en el compositor.**
      Toda esta tabla está medida en la caja de redacción. El feed puede usar
      otra fuente u otra pila de renderizado, así que el resultado podría ser
      distinto —mejor o peor— en el sitio que de verdad importa, que es donde
      lo leen los demás. De esa comprobación depende si el defecto de ADR-018
      se queda en la opción A o pasa a la B.
