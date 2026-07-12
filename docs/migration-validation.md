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
| install | `npm ci --foreground-scripts` | Pasa | `duration=3:34.76 exit=0`; `found 0 vulnerabilities`; Prisma Client generado | Warnings transitorios de paquetes deprecated y aviso de Prisma schema default antes del postinstall raiz. |
| lint | `npm run lint` | Pasa | Revalidacion final: `duration=1:34.04 exit=0` | `eslint apps packages scripts --max-warnings=0`. |
| typecheck | `npm run typecheck` | Pasa | Revalidacion final: `duration=1:03.00 exit=0` | `tsc --noEmit -p tsconfig.json`. |
| test | `npm test -- --reporter=dot` | Pasa | `100 passed (100)`, `381 passed (381)`, `duration=27.33s exit=0` | Incluye permisos de importacion de oferta, transaccion atomica, alcance por plantel, cache del cotizador y regresion UI. |
| build | `npm run build` | Pasa | Revalidacion final: `Compiled successfully in 5.4min`, `16/16`, `duration=6:37.09 exit=0` | Ejecuta typecheck antes de `next build --webpack`; manifiesto incluye admin/importaciones y no genera rutas Neon Auth. |
| Prisma schema | `npm run db:validate` con URLs locales placeholder | Pasa | `The schema ... is valid` | El primer intento sin `DIRECT_URL` fallo con `P1012`; no hubo conexion remota. |

## Panel administrativo, importaciones y cotizador

| Validacion | Resultado | Evidencia | Observaciones |
| --- | --- | --- | --- |
| Flujo de borrador | Pasa local | `OfferImportClient` ya no invoca apply/rollback directamente; enlaza al detalle de sesion | La publicacion exige revisar impacto, checkbox y texto exacto `PUBLICAR`. |
| Permisos de preview/apply | Pasa local | Tests de ruta comprueban `view_admin_operations` y `manage_offers` | La sesion no se consulta ni aplica cuando falta la capacidad del modulo. |
| Atomicidad | Pasa local | Test de `academic-offer-replace` verifica que programas y ofertas usan el mismo `TransactionClient` | Evita programas parcialmente creados si falla el reemplazo de oferta. |
| Alcance de reemplazo | Pasa local | `deleteMany` queda filtrado por ciclo y `campusId in [...]` | Un archivo parcial no elimina oferta de planteles no incluidos. |
| Integracion con cotizador | Pasa local | La importacion escribe `programOffering`; tests de quote existentes y nuevos tags de cache pasan | Se invalidan oferta, planes, formatos y planteles tras apply o rollback. |
| Estado del catalogo admin | Pasa por codigo | Estado `unavailable` separado de catalogo incompleto | El panel no muestra conteos falsos `0/24` ni comandos locales inaplicables en Vercel. |
| E2E autenticado | No ejecutado | Test Playwright actualizado al flujo validar -> revisar -> confirmar -> publicar | Falta esquema staging aplicado y usuario E2E; no se marco como aprobado. |

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
| `/auth/sign-in` | `status=200 size=25150` |
| `/admin/oferta` | Respuesta RSC contiene `NEXT_REDIRECT;replace;/admin/auth;307` |
| `/admin/importaciones` | Respuesta RSC protegida sin sesion |
| `POST /api/admin/import-academic-offer` sin sesion | `status=401` |

El servidor emitio `Ready in 324ms` y no mostro errores durante los curls. El
proceso se detuvo con `Ctrl-C`. `agent-browser` no esta instalado en el host
(`command not found`), por lo que no se marco una inspeccion visual como
aprobada.

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

Vercel inyecta las variables de la integracion Supabase en Preview, pero sus
valores sensibles no se descargaron al entorno local. No se creo un usuario de
prueba ni se aplico el esquema staging, por lo que siguen pendientes:

- Aplicar migraciones a Supabase staging.
- Seed real de staging.
- Inicio de sesion real con Supabase Auth.
- Recuperacion de sesion autenticada con cookies reales.
- Lectura/escritura real contra Supabase PostgreSQL staging.
- Validacion RLS remota por organizacion/rol.
- Suscripcion Realtime real con `postgres_changes`.
- Upload/download real en Supabase Storage.
- Pruebas Playwright autenticadas.
- Captura visual del panel autenticado y del detalle de importacion con datos reales.
- Lectura/escritura de dominio, Realtime y Storage, porque el esquema staging no
  ha sido aplicado.

## Hallazgos

- El build principal ya no usa OpenNext ni Wrangler.
- No hay imports activos de `@opennextjs/cloudflare` ni `getCloudflareContext` fuera de `legacy/cloudflare`.
- Queda un script de exportacion D1 que referencia `wrangler` de forma intencional y dry-run por defecto.
- Persisten nombres internos `D1`/`R2` en helpers de compatibilidad y pruebas; no representan bindings Cloudflare activos, pero deben renombrarse en una limpieza posterior.
- Varias rutas siguen usando Prisma y el adaptador PostgreSQL-compatible de los antiguos repositorios D1; la consolidacion total a clientes/repositorios Supabase nativos queda pendiente antes de produccion.
- El login, callback, refresh SSR, formularios y diagnostico `auth-sync` usan
  Supabase Auth. El panel, webhook y scripts Neon Auth se retiraron de App
  Router y permanecen solo en `legacy/neon-auth/` para referencia de rollback.
- El manifiesto de `next build` conserva `/admin/auth-sync` y no contiene
  `/admin/integrations/neon-auth` ni `/api/integrations/neon-auth/*`.
- `@neondatabase/serverless`, sus aliases npm y el workflow manual de limpieza
  Neon se retiraron del proyecto activo y se preservaron en
  `legacy/neon-database/`.
- La importacion de oferta ya no publica desde el panel sin confirmacion: crea
  una sesion preview y dirige al detalle revisable.
- El reemplazo de oferta es atomico y queda limitado a los planteles presentes
  en el archivo; apply y rollback revalidan los catalogos usados por el
  cotizador.
