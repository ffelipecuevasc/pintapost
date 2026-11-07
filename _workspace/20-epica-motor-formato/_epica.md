# Épica B — Motor de formato

**Estado:** 🟢 Completada (2026-09-01) — S03 🟢 · S04 🟢 · S05 🟢
**Sprints:** S03 (serializador), S04 (modelo y editor), S05 (portapapeles)
**Etapa:** 1 — MVP sin IA

## Objetivo

Construir el núcleo del producto: el usuario escribe, selecciona, aplica estilos
que ve en tiempo real, y al copiar obtiene una cadena Unicode que LinkedIn
preserva. Es la épica que decide si PintaPost funciona o no.

## Orden y por qué

1. **S03 — Serializador primero.** Funciones puras, sin DOM, con tests. Se puede
   validar la hipótesis central (¿sobrevive el formato al pegar en LinkedIn?)
   sin haber escrito una línea de interfaz. Si falla, falla barato.
2. **S04 — Modelo y editor.** El estado `{text, ranges}` y el render con CSS.
3. **S05 — Portapapeles y contador.** Une lo anterior con el botón de copiar.

## Criterios de aceptación

- [x] Todo el abecedario español, mayúsculas y minúsculas, con tildes, ñ y ü, se
      convierte correctamente en negrita, cursiva, negrita-cursiva, subrayado y
      tachado.
- [x] Los caracteres sin mapeo (`¿ ¡ º ª « » €`, emojis, dígitos en cursiva)
      pasan intactos, nunca producen un carácter no asignado.
- [x] El texto pegado en LinkedIn real conserva el formato en los 5 entornos
      objetivo.
- [x] El cursor y el borrado se comportan con normalidad en todo momento.
- [x] "Limpiar formato" devuelve el texto plano original exacto.
- [x] Los hashtags y menciones nunca reciben formato.
- [x] Cobertura de tests sobre las funciones puras del serializador: 100 % de
      las ramas.

## Definition of Done

1. Todas las casillas del sprint marcadas.
2. `pnpm test` en verde.
3. Sin errores en consola.
4. Probado manualmente pegando en LinkedIn real, no solo revisando el
   portapapeles del sistema.
5. Commit en Conventional Commits.
6. Bitácora actualizada.

## Decisiones que gobiernan esta épica

ADR-003 (modelo primero), ADR-004 (sans-serif), ADR-005 (marcas combinables),
ADR-012 (contador dual), ADR-013 (hashtags intocables). Leerlas antes de empezar.

## Fuera de alcance

Borradores, vista previa de LinkedIn, despliegue, IA.

---

## Cierre de la épica

_Añadido por Claude Code el 2026-09-01._

Los tres sprints están cerrados y los siete criterios verificados. PintaPost
funciona de principio a fin: se escribe, se da formato, se copia y LinkedIn lo
conserva.

### Evidencia de cada criterio

| Criterio | Dónde se verificó |
|---|---|
| Abecedario español completo en los cinco estilos | `tests/unicode.test.js` (S03) y pegado real en LinkedIn (S05, tarea 9) |
| Caracteres sin mapeo intactos | `tests/unicode.test.js` + corpus de `serialize.test.js` con `¿ ¡ º ª « » €` y emojis |
| Formato conservado en los 5 entornos objetivo | Verificación cross-device del S03 y pegado real del S05 en escritorio, Chrome Android y Safari iOS |
| Cursor y borrado con normalidad | S04, verificado en navegador, con `tests/roundtrip.test.js` sosteniendo el invariante |
| «Limpiar formato» devuelve el original exacto | `tests/commands.test.js` y el round-trip `stripStyling(serialize(m)) === m.text` |
| Hashtags y menciones nunca reciben formato | `tests/protect.test.js`, `tests/serialize.test.js` y —lo que importaba— el hashtag sigue siendo enlace azul en LinkedIn |
| Cobertura de las funciones puras del serializador | 348 tests en 68 suites; las rutas de `unicode.js`, `segments.js`, `protect.js` y `serialize.js` cubiertas, incluidos los bordes |

### Lo que esta épica dejó decidido

Tres cosas que gobiernan lo que venga después y que conviene no volver a
discutir:

1. **La conversión a Unicode ocurre solo al copiar** (ADR-003). El editor guarda
   `{ text, ranges }` y muestra el formato con CSS real. Todo lo demás —copiar
   sin formato, limpiar formato, el contador de grafemas— sale gratis de ahí.
2. **Una sola segmentación** para pintar y para serializar (`segments.js`, S05).
   Es lo que hace estructuralmente imposible que se copie algo distinto de lo
   que se ve.
3. **LinkedIn cuenta unidades UTF-16** (ADR-012, confirmado en la tarea 9 del
   S05). El contador dual no es un adorno: sin él, un post en negrita se trunca
   a la mitad de su longitud aparente sin explicación.

### Lo que queda anotado para más adelante

- El **defecto de `styleCombining`** sigue en `true`. ADR-018 dejó su revisión
  atada a comprobar el renderizado en el feed ya publicado, no solo en el editor
  de LinkedIn; la casilla ya existe y el usuario puede cambiarlo.
- El **aviso completo de accesibilidad** del texto Unicode es del S06. En el S05
  quedó solo la línea que explica para qué sirve «Copiar sin formato».
- La línea del **subrayado sigue cruzando los hashtags** en el editor. Es una
  limitación conocida de `text-decoration`, documentada en `styles.css` y en el
  archivo del S05.

**Siguiente:** épica C — Lanzamiento MVP (S06 y S07).
