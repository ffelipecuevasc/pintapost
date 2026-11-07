# Configuración manual — GitHub

Todo lo que hay que hacer desde la web de GitHub, y que Claude Code no puede
tocar. Se marca conforme se completa.

## Estado

| Tarea | Sprint | Estado |
|---|---|---|
| Repositorio creado y vinculado | previo | 🟢 |
| Branch protection en `main` | S07 | ⚪ |
| GitHub Actions de CI | S07 | ⚪ |
| Dependabot activado | S07 | ⚪ |
| CodeQL activado | S07 | ⚪ |
| Descripción, topics y About del repo | S07 | ⚪ |
| Release `v1.0-etapa1` | S07 | ⚪ |

## Funciones gratuitas a aprovechar

| Función | Uso en PintaPost |
|---|---|
| Actions | Build de Tailwind + `npm test` en cada pull request. Gratis e ilimitado en repos públicos. |
| Dependabot | Avisos de vulnerabilidades en las devDependencies. Gratis en público. |
| CodeQL | Análisis estático de JavaScript. Gratis en público. |
| Branch protection | `main` solo por pull request con CI en verde. |
| Issues y Projects | Espejo público del backlog, si algún día se quiere colaboración externa. |
| Releases y tags | `v1.0-etapa1`, `v2.0-etapa2`. |
| Repositorio privado | Backup remoto opcional de `_workspace/`, separado del público. |

## Notas

- El CI de GitHub Actions es **complementario** al build de Cloudflare, no
  sustituto. Cloudflare construye y despliega; Actions valida antes de mergear.
- No configurar Actions para desplegar: eso lo hace Cloudflare directamente
  desde el repositorio.

## Pasos pendientes

_(Se irán detallando en el sprint correspondiente, con la ayuda de Claude web.)_
