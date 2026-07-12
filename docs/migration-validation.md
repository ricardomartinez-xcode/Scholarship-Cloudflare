# Validacion de migracion Vercel + Supabase

Fecha: 2026-07-12  
Rama: `migration/vercel-supabase`  
Produccion Cloudflare: no modificada

## Entorno local

| Elemento | Valor |
| --- | --- |
| Node | `v24.15.0` |
| npm | `11.12.1` |
| Gestor | npm con `package-lock.json` |
| Supabase CLI | No instalado (`supabase: command not found`) |
| Supabase staging | Integracion conectada; Auth/JWKS verificados; esquema pendiente |
| Vercel | Proyecto `re-lead/scholarship`; Preview `READY` |
| Runtime compat local | `POSTGRES_COMPAT_RUNTIME=1` opcional para probar rutas legacy D1-named con PostgreSQL |

No se leyeron ni imprimieron secretos. Para el smoke local se usaron placeholders no secretos.

## Validaciones obligatorias

| Validacion | Comando | Resultado | Evidencia | Observaciones |
| --- | --- | --- | --- | --- |
| install | `npm ci --foreground-scripts` | Pasa | `duration=3:34.72 exit=0`; `found 0 vulnerabilities`; Prisma Client generado | Warnings transitorios de paquetes deprecated y aviso de Prisma schema default antes del postinstall raiz. |
| lint | `npm run lint` | Pasa | `duration=1:02.24 exit=0` | `eslint apps packages scripts --max-warnings=0`. |
| typecheck | `npm run typecheck` | Pasa | `duration=0:14.35 exit=0` | `tsc --noEmit -p tsconfig.json`. |
| test | `npm test` | Pasa | `97 passed (97)`, `377 passed (377)`, `duration=25.13s exit=0` | Vitest local despues del ajuste Supabase/Vercel. |
| build | `npm run build` | Pasa | `Compiled successfully in 3.2min`, `Generating static pages ... (16/16)`, `duration=6:34.1 exit=0` | El build ejecuta `npm run typecheck` primero y despues `NEXT_SKIP_INTERNAL_TYPECHECK=1 next build --webpack` para evitar OOM en la validacion interna duplicada de Next. |

## Smoke local

Servidor:

```bash
PORT=3100 \
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-placeholder \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
POSTGRES_COMPAT_RUNTIME=1 \
npm run start
```

Resultado:

| Ruta | Resultado |
| --- | --- |
| `/` | `status=200 size=57442` |
| `/legal/privacy` | `status=200 size=39139` |
| `/auth/sign-in` | `status=200 size=25576` |

El servidor emitio `Ready in 339ms` y no mostro errores durante los curls. El proceso se detuvo con `Ctrl-C`.

## Scripts de migracion

| Script | Comando | Resultado | Observaciones |
| --- | --- | --- | --- |
| Export D1 | `npm run migration:export-d1` | Pasa, dry-run | Imprime comandos `wrangler d1 execute` sin ejecutarlos; escribe manifiesto local temporal. |
| Transform D1 -> Postgres | `npm run migration:transform-d1` | Pasa, dry-run | Mapea tablas conocidas y omite `outbox_event` para realtime. |
| Import Supabase | `npm run migration:import-supabase` | Pasa, dry-run | Detecta 0 filas en el manifiesto dry-run; no escribe remoto. |
| Validate data | `npm run migration:validate-data` | Pasa local | Cuenta JSONL locales; remoto omitido sin `--remote`. |
| Migrate Storage | `npm run migration:migrate-storage` | Pasa, dry-run | Sin manifest R2, genera reporte vacio local. |

Los artefactos generados por dry-run se retiraron del working tree y no se commitearon.

## Validacion remota parcial

| Validacion | Resultado | Evidencia | Observaciones |
| --- | --- | --- | --- |
| Supabase JWKS | Pasa | Respuesta ES256/P-256 con el `kid` esperado | Verifica el endpoint publico; no concede acceso administrativo. |
| Proyecto Vercel | Pasa | Next.js, Node 22, raiz monorepo, comandos install/build y output verificados | GitHub enlazado; produccion Git permanece en `main`. |
| Variables Supabase Preview | Pasa | Publicas limitadas a la rama; secretos de integracion habilitados para Preview | Vercel mantiene ocultos los valores `sensitive`. |
| Preview inicial | Corregido | Vercel rechazo los globs `functions` que no coincidian con funciones detectadas | Se eliminaron los overrides; Vercel usa deteccion App Router. |
| Preview final | Pasa | `Compiled successfully`, 16 paginas generadas, deployment completado | `https://scholarship-git-migration-vercel-supabase-re-lead.vercel.app`. |
| Supabase Auth API | Pasa parcial | health/settings `200`; email habilitado | Google y phone deshabilitados; no se creo usuario de prueba. |
| Rutas publicas | Pasa parcial | `/`, `/legal/privacy`, `/auth/sign-in` = `200`; after-login sin sesion = `303` | Vercel Deployment Protection se valido con bypass CLI. |
| Lectura PostgreSQL | Bloqueada | `/api/public/campuses` = `500` | Prisma: `recalc_admin.campus` no existe; requiere aplicar migraciones staging. |

## Validaciones no realizadas

No se ejecutaron estas pruebas porque el acceso aportado no incluye claves de
cliente, conexiones PostgreSQL ni credenciales administrativas Supabase:

- Aplicar migraciones a Supabase staging.
- Seed real de staging.
- Inicio de sesion real con Supabase Auth.
- Recuperacion de sesion autenticada con cookies reales.
- Lectura/escritura real contra Supabase PostgreSQL staging.
- Validacion RLS remota por organizacion/rol.
- Suscripcion Realtime real con `postgres_changes`.
- Upload/download real en Supabase Storage.
- Pruebas Playwright autenticadas.
- Lectura/escritura de dominio, Realtime y Storage, porque el esquema staging no
  ha sido aplicado.

## Hallazgos

- El build principal ya no usa OpenNext ni Wrangler.
- No hay imports activos de `@opennextjs/cloudflare` ni `getCloudflareContext` fuera de `legacy/cloudflare`.
- Queda un script de exportacion D1 que referencia `wrangler` de forma intencional y dry-run por defecto.
- Persisten nombres internos `D1`/`R2` en helpers de compatibilidad y pruebas; no representan bindings Cloudflare activos, pero deben renombrarse en una limpieza posterior.
- Varias rutas siguen usando Prisma y el adaptador PostgreSQL-compatible de los antiguos repositorios D1; la consolidacion total a clientes/repositorios Supabase nativos queda pendiente antes de produccion.
- El login, callback, refresh SSR y formularios activos usan Supabase Auth. El
  panel administrativo `integrations/neon-auth`, su webhook legacy y el reporte
  basado en `neon_auth.user` permanecen como deuda aislada; no son dependencias
  del flujo de sesion.
