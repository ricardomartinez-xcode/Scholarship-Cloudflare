# Despliegue Vercel para migracion Supabase

## Estado

- Rama: `migration/vercel-supabase`
- Proyecto: `re-lead/scholarship` enlazado al repositorio GitHub.
- Preview remoto: `https://scholarship-git-migration-vercel-supabase-re-lead.vercel.app`
  en estado `READY` (alias estable de la rama).
- Produccion Cloudflare: no modificada.
- Entorno objetivo inicial: Vercel Preview + Supabase staging.

## Configuracion del proyecto Vercel

| Campo | Valor |
| --- | --- |
| Framework | Next.js |
| Root Directory | raiz del monorepo |
| Install Command | `npm ci --foreground-scripts` |
| Build Command | `npm run build` |
| Output Directory | `apps/web/.next` |
| Node | `>=20 <25`, recomendado Node 22 en CI/Vercel |
| Package manager | npm 11 |

La configuracion remota verificada usa `framework=nextjs`, Node `22.x`, raiz del
monorepo, `npm ci --foreground-scripts`, `npm run build` y
`apps/web/.next`. La rama de produccion Git de Vercel sigue siendo `main`; no se
promovio ningun Preview ni se agrego un dominio productivo.

La raiz queda en el monorepo porque `apps/web` depende de paquetes internos en `packages/*` y del Prisma client generado desde `packages/db/prisma/schema.prisma`.

## `vercel.json`

La configuracion se mantiene pequena:

- `framework: nextjs`
- `buildCommand: npm run build`
- `outputDirectory: apps/web/.next`
- deteccion automatica de funciones App Router y limites por defecto de Vercel

No se definen patrones `functions` sobre rutas fuente. Vercel aplica esa
configuracion a funciones detectadas y rechaza globs que no coinciden con el
artefacto de build; cualquier timeout especial debe agregarse despues de medir
una funcion concreta en Preview.

Las migraciones de base de datos no se ejecutan dentro del build. Deben aplicarse explicitamente contra Supabase staging antes del Preview cuando haya credenciales.

## Variables

### Publicas

| Variable | Uso | Entornos |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | URL base de la app para redirects y callbacks | Preview, Production futura |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clave publica recomendada para navegador/SSR | Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | alias legacy aceptado si la integracion no entrega publishable key | Preview |

### Server-only

| Variable | Uso | Entornos |
| --- | --- | --- |
| `DATABASE_URL` o `POSTGRES_PRISMA_URL` | Conexion PostgreSQL runtime/Prisma mientras se termina el desacople | Preview |
| `DIRECT_URL` o `POSTGRES_URL_NON_POOLING` | Conexion directa para Prisma y herramientas | Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones administrativas server-side, migracion y Storage controlado | Preview, solo servidor |
| `POSTGRES_COMPAT_RUNTIME` | Switch local opcional para rutas legacy D1-named respaldadas por PostgreSQL | Local opcional |

No uses `SUPABASE_SERVICE_ROLE_KEY` en componentes cliente ni con prefijo `NEXT_PUBLIC_`.

Vercel define `VERCEL=1`; con eso las rutas legacy D1-named usan el adaptador PostgreSQL-compatible sin configurar `POSTGRES_COMPAT_RUNTIME`.

La integracion Supabase habia creado sus variables solo para Vercel Production.
Para el Preview se habilitaron los secretos administrados
`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` y
`SUPABASE_SERVICE_ROLE_KEY`; las claves publicas se limitaron a
`Preview (migration/vercel-supabase)`. La aplicacion acepta esos nombres nativos
como aliases de `DATABASE_URL` y `DIRECT_URL` sin copiar secretos al repositorio.

## Supabase Auth URLs

Configurar en Supabase staging:

| Campo | Valor |
| --- | --- |
| Site URL | URL del Preview Vercel o subdominio staging |
| Redirect URL | `<preview-url>/auth/callback` |
| Redirect URL local | `http://127.0.0.1:3000/auth/callback` |

Cuando se genere un nuevo Preview, agregar su dominio a Redirect URLs si Supabase no permite comodines para el equipo/proyecto.

## Supabase staging

El proyecto staging ya esta enlazado. Para aplicar solo migraciones pendientes:

```bash
npx supabase migration list --linked
npx supabase migration up --linked --yes
```

o aplicar manualmente las migraciones versionadas de `supabase/migrations` contra staging. No ejecutar contra produccion.

Despues:

```bash
npm run migration:import-supabase
npm run migration:migrate-storage
npm run migration:validate-data
```

Los comandos por defecto son dry-run. Usar `--apply` o `--remote` solo con credenciales staging revisadas.

## Preview Deployment

Objetivo recomendado:

| Elemento | Valor |
| --- | --- |
| Rama | `migration/vercel-supabase` |
| Deployment | Vercel Preview |
| Base de datos | Supabase staging |
| Auth | Supabase Auth staging |
| Storage | Supabase Storage staging |
| Dominio | Preview Vercel o subdominio staging |

Pasos:

1. Conectar el repo en Vercel sin cambiar el dominio productivo.
2. Seleccionar raiz del monorepo.
3. Configurar variables Preview con valores de Supabase staging.
4. Confirmar que `npm run build` es el build command.
5. Crear Preview desde la rama.
6. Probar login, ruta protegida, lectura/escritura, Realtime y upload.
7. Registrar la URL y resultados en `docs/migration-validation.md`.

## Rollback

Rollback tecnico antes de produccion:

1. No promover el Preview.
2. Mantener DNS y dominio actual apuntando a Cloudflare.
3. Desactivar o eliminar el proyecto Preview si ya no se necesita.
4. No borrar datos staging hasta completar comparaciones.
5. Conservar produccion Cloudflare intacta como ruta activa.

Rollback despues de una promocion futura:

1. Pausar trafico hacia Vercel o retirar alias de dominio.
2. Restaurar dominio a la configuracion Cloudflare anterior.
3. Congelar escrituras en Supabase si hubo dual-write o migracion incremental.
4. Comparar conteos y timestamps de los datos escritos durante la ventana.
5. Reconciliar manualmente cualquier dato creado solo en Supabase antes de volver a abrir escrituras.

## Estado validado y limitaciones

- Preview de rama: `https://scholarship-git-migration-vercel-supabase-re-lead.vercel.app`.
- Las rutas publicas y APIs de oferta/costos/beneficios respondieron `200` tras
  aplicar el esquema; login, cookie SSR, logout y panel admin se validaron.
- No existen variables Neon activas en el Preview. La integracion entrega
  variables Supabase publicas y aliases PostgreSQL administrados por Vercel.
- Supabase Realtime abre el WebSocket del proyecto correcto desde el bundle.
- Google OAuth permanece deshabilitado; email/password es el proveedor probado.
- Algunas rutas de dominio conservan Prisma como cliente PostgreSQL transitorio.
- El calculo monetario del cotizador requiere cargar tarifas/beneficios reales
  de staging; no se inventaron valores.
- El Preview no se promovio y no se agrego ningun dominio productivo.
