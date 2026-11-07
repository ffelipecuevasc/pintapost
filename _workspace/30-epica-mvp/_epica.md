# Épica C — Lanzamiento del MVP (Etapa 1)

**Estado:** ⚪ No iniciada
**Sprints:** S06 (pulido), S07 (despliegue)
**Etapa:** 1 — MVP sin IA

## Objetivo

Convertir un editor que funciona en un producto que se puede anunciar: no perder
el trabajo del usuario, mostrarle cómo quedará su post, ser honestos sobre las
limitaciones del texto Unicode, y ponerlo en línea con un dominio propio.

## Criterios de aceptación

- [ ] El texto sobrevive a cerrar y reabrir la pestaña.
- [ ] El usuario ve dónde caerá el corte de "…ver más" de LinkedIn antes de
      publicar.
- [ ] Existe la opción "Copiar como texto plano" y un aviso comprensible sobre
      accesibilidad e indexación (ADR-013, H-10).
- [ ] Toda la interfaz es navegable por teclado y con lector de pantalla.
- [ ] Peso total < 120 KB comprimido; LCP < 1,5 s en 4G simulado.
- [ ] Existe una política de privacidad accesible desde el pie.
- [ ] El sitio está en producción, con HTTPS y despliegue continuo desde `main`.
- [ ] Hay métricas de uso sin cookies (por tanto, sin banner de consentimiento).
- [ ] Validado el pegado real en Chrome, Edge, Safari escritorio, Safari iOS y
      Chrome Android, en LinkedIn web y en la app móvil.

## Definition of Done

Igual que la épica B, más:
7. Verificado en dispositivo físico iOS y Android, no solo en emulador.
8. Los pasos de configuración manual quedan documentados en `90-manual/`.

## Hito

Al cerrar el S07: **primer lanzamiento público de PintaPost**, sin IA, sin
ninguna dependencia externa de cuota. Producto completo por sí mismo.
