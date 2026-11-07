# Épica D — Capa de Inteligencia Artificial (Etapa 2)

**Estado:** ⚪ No iniciada
**Sprints:** S08 (worker y seguridad), S09 (integración en la interfaz)
**Etapa:** 2 — se añade sobre un producto ya lanzado

## Objetivo

Añadir un generador de ideas de publicación sin login, protegido y observable
desde el primer día, sin que una caída o una saturación de Gemini degrade el
producto base.

## Arquitectura

```
Navegador → Worker /api/generate-idea → AI Gateway → Gemini Flash-Lite
              ↑ Turnstile                  ↑ caché + rate limit + analítica
              ↓ si 429 persistente
            Workers AI
              ↓ si falla
            Banco estático de ideas (JSON servido como asset)
```

## Criterios de aceptación

- [ ] La clave de Gemini no aparece jamás en ninguna respuesta ni petición
      visible desde el cliente.
- [ ] El endpoint rechaza: métodos distintos de POST, `Content-Type` incorrecto,
      cuerpos por encima del tamaño máximo, y temas fuera de la lista cerrada.
- [ ] Turnstile invisible está activo (ADR-007).
- [ ] AI Gateway cachea las combinaciones tema+tono+variante (ADR-008).
- [ ] Un 429 produce un mensaje explícito de servicio limitado, nunca un spinner
      infinito.
- [ ] Si Gemini está caído, el usuario sigue recibiendo una idea (degradación).
- [ ] Todo el flujo se mantiene dentro de los tiers gratuitos.
- [ ] La política de privacidad menciona el envío del tema a Google.

## Definition of Done

Igual que la épica C, más:
9. Prueba de abuso: ráfaga de peticiones al endpoint y verificación de que
   Turnstile y el rate limiting la contienen.
10. `wrangler tail` revisado durante las pruebas, sin errores inesperados.

## Riesgo principal

El free tier de Gemini limita a nivel de proyecto, no de usuario: ~15 RPM
compartidos entre todos los visitantes del mundo. La caché de AI Gateway es la
mitigación de mayor impacto, no un extra. Ver H-04 y ADR-008.
