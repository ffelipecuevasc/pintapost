# Configuración manual — Cloudflare

Todo lo que hay que hacer desde el panel de Cloudflare. Claude Code puede
generar `wrangler.jsonc` y los comandos, pero no puede entrar al panel ni
autenticarse.

## Estado

| Tarea | Sprint | Estado |
|---|---|---|
| Cuenta de Cloudflare creada | previo | ⚪ |
| Proyecto de Workers creado y vinculado a GitHub | S07 | ⚪ |
| Comando y directorio de build configurados | S07 | ⚪ |
| Dominio o subdominio asignado | S07 | ⚪ |
| Web Analytics activado | S07 | ⚪ |
| Preview URLs por rama habilitadas | S07 | ⚪ |
| AI Gateway creado | S08 | ⚪ |
| Clave de Gemini guardada como secreto del Worker | S08 | ⚪ |
| Turnstile: site key y secret key generadas | S08 | ⚪ |

## Funciones gratuitas a aprovechar

| Función | Uso |
|---|---|
| Workers + Static Assets | Hosting. Las peticiones de assets son gratuitas y no consumen invocaciones. |
| Workers Builds | Despliegue continuo desde GitHub. |
| Preview URLs | Una URL por rama para QA antes de mergear. |
| Web Analytics | Métricas sin cookies → **sin banner de consentimiento**. |
| AI Gateway | Caché, rate limiting, reintentos y analítica delante de Gemini, sin código. |
| Turnstile | Anti-abuso invisible. |
| Secretos del Worker | Donde vive la clave de Gemini. |
| Cache Rules, Brotli, HTTP/3 | Automáticos, sin configuración. |
| `wrangler tail` | Logs en tiempo real (Etapa 2). |

## Configuración de build esperada

```
Comando de build:        npm run build
Directorio de salida:    dist
Rama de producción:      main
```

## Avisos importantes

- **La clave de Gemini nunca se escribe en un archivo del repositorio.** Va como
  secreto en el panel de Cloudflare o vía `npx wrangler secret put`.
- Workers no permite bindings distintos por rama. Si se quiere un staging con
  cuota separada, hace falta un Worker y un proyecto de Google Cloud aparte
  (backlog X-08).
- Recordar crear `.assetsignore`: Workers no excluye `node_modules` ni `.git`
  automáticamente como hacía Pages.

## Pasos pendientes

_(Se irán detallando en el sprint correspondiente, con la ayuda de Claude web.)_
