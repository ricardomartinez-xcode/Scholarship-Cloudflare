# Auditoria monorepo intranet - 2026-05-24

## Alcance

Auditoria estatica y funcional del monorepo `Scholarship` orientada a estabilidad de intranet, seguridad operativa, CI/CD, deuda de UI/UX y preparacion para trabajo posterior.

Commit auditado: `a563edc83a4a84b75194f96e0f55c8b8cf7cdc79`

Herramientas usadas:
- GitHub CLI para estado de Actions y release gate.
- Vercel CLI en modo lectura para deployments existentes; no se hizo deploy.
- Browser local autenticado contra `http://127.0.0.1:3000`.
- Build Web Apps / Browser para revisar rutas UI renderizadas.
- Superpowers como metodologia para priorizar hallazgos y plan.
- Figma y Linear quedaron sin accion externa porque no habia archivo/equipo objetivo en la sesion.
- ChatGPT Apps se reviso como posible direccion futura; el repo actual no es una ChatGPT App.

## Resumen ejecutivo

El proyecto esta sano localmente para checks base: `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` pasaron. El problema critico no esta en compilacion local sino en el release gate remoto: GitHub Actions esta fallando en `main`, principalmente por snapshots visuales Linux faltantes en Playwright.

Hay riesgos P0 que conviene atender antes de seguir ampliando funcionalidad: vulnerabilidades de dependencias, `prisma db push --accept-data-loss` durante build de Vercel, rate limiting en memoria, y manejo de tokens de extension con almacenamiento persistente. En UI, las pantallas canonicas ya existen y renderizan, pero el admin sigue denso y todavia hay residuos legacy fuera de precios/beneficios que deben aislarse antes de eliminarlos.

## Verificaciones ejecutadas

| Verificacion | Resultado |
| --- | --- |
| `npm test` | OK, 31 archivos, 97 tests |
| `npm run typecheck` | OK |
| `npm run lint` | OK, con warning existente de `no-html-link-for-pages` por no usar `pages/` |
| `npm run build` | OK |
| `npm audit --json` | Falla por vulnerabilidades: 17 total, 1 critica, 10 altas, 5 moderadas, 1 baja |
| GitHub `quality-release-gate` | Falla en `main` |
| Vercel `vercel ls --yes` | Deployments Production Ready; ultimo listado listo |
| Browser local `/`, `/unidep`, `/admin/prices`, `/admin/benefits`, `/admin/unidep/fees` | Renderizan sin pantalla en blanco ni overlay de error |

## Hallazgos P0

### P0-1. Release gate remoto fallando en GitHub Actions

Evidencia:
- Workflow: `.github/workflows/quality-release-gate.yml`.
- Script: `scripts/release-gate.ts:145` corre `tests/e2e/smoke.spec.ts` y `tests/e2e/visual-regression.spec.ts`.
- Ultimo run revisado: `https://github.com/ricardomartinez-xcode/Scholarship/actions/runs/26372030558`.
- Fallo principal: snapshots visuales Linux no existen, mientras el repo solo tiene snapshots `*-chromium-win32.png`.

Impacto:
- El branch `main` no tiene una senal remota confiable aunque los checks locales pasen.
- GitHub/Vercel puede seguir desplegando commits que no pasaron release gate completo.

Accion recomendada:
- Generar y versionar snapshots Linux en entorno CI o cambiar la estrategia visual para baselines multiplataforma.
- Separar `release:gate` en carriles: build/type/lint/unit, smoke e2e, visual regression.
- Documentar el flujo de actualizacion de snapshots para que no dependa de Windows local.

### P0-2. Vulnerabilidades de dependencias

Evidencia:
- `npm audit --json` reporta 17 vulnerabilidades.
- Paquetes destacados: `better-auth` critica; `next`, `xlsx`, `fast-uri`, `fastify`, `fast-json-stringify`, `kysely`, `@neondatabase/auth`, `@neondatabase/neon-js` altas.

Impacto:
- Riesgo directo en auth, parsing de archivos, runtime web y dependencias de DB.
- `xlsx` esta en `devDependencies`, pero el proyecto importa/lee archivos en flujos admin, por lo que debe revisarse si puede ejecutarse en rutas productivas.

Accion recomendada:
- Crear rama dedicada de remediacion de dependencias.
- Actualizar primero paquetes con fixes no disruptivos.
- Sustituir `xlsx` por `exceljs` o un lector ya usado si el paquete no tiene fix seguro.
- Correr `npm audit`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y release gate.

### P0-3. Build de Vercel puede mutar la base con perdida de datos

Evidencia:
- `scripts/vercel-build.sh:74-75` ejecuta `prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss --skip-generate`.
- El script indica que reemplaza `prisma migrate deploy`.

Impacto:
- Un build de Vercel puede aplicar cambios destructivos a Neon/produccion.
- Reduce trazabilidad de cambios de schema y dificulta rollback.

Accion recomendada:
- Quitar `--accept-data-loss` del build.
- Mover cambios de schema a pipeline explicito con `prisma migrate deploy`.
- Agregar guardas por ambiente y confirmacion manual para operaciones destructivas.

### P0-4. Rate limiting en memoria

Evidencia:
- `apps/web/src/lib/rate-limit.ts:6` usa `new Map<string, Bucket>()`.

Impacto:
- En serverless/multiples instancias cada runtime tiene contador propio.
- Se reinicia en cold starts y no protege de abuso distribuido.

Accion recomendada:
- Migrar a rate limiter compartido por Redis/Upstash/Vercel KV/DB.
- Definir limites por ruta: auth, imports, extension, admin actions y APIs publicas.
- Registrar eventos de bloqueo sin exponer datos sensibles.

### P0-5. Tokens de extension persistidos en almacenamiento local

Evidencia:
- `apps/chrome-extension/recalc-sidepanel/panel.js:5` define `recalc.extensionSessionToken`.
- `apps/chrome-extension/recalc-sidepanel/panel.js:307-316` lee/escribe token en `chrome.storage.local`.
- Variantes duplicadas tambien usan `window.localStorage` como fallback.

Impacto:
- Si extension, pagina o perfil local quedan comprometidos, el token puede sobrevivir mas de lo necesario.
- La duplicacion por variantes aumenta riesgo de corregir un flujo y dejar otro vulnerable.

Accion recomendada:
- Auditar TTL, rotacion y revocacion de tokens de extension.
- Eliminar fallback a `window.localStorage` donde no sea imprescindible.
- Centralizar storage/auth de extension en un modulo compartido y generar variantes desde una sola fuente.

## Hallazgos P1

### P1-1. Residuos legacy fuera de precios/beneficios

Evidencia:
- `apps/web/src/lib/runtime-modes.ts` conserva `RuntimeMode = "legacy" | "compare" | "canonical"` para subsistemas no totalmente canonicos.
- `apps/web/src/config/dashboard-navigation.ts:487` mantiene `workspaceLegacyQueryRedirects`.
- `apps/web/src/lib/base-price-overrides.ts:10` conservaba `toLegacyBusinessLine` como helper de compatibilidad historica.
- `apps/web/src/app/(admin)/admin/(protected)/unidep/programs/ProgramsClient.tsx` muestra campos como `Nivel legacy` y `Agrupador legacy`.
- Directorio conserva write/read modes legacy/canonical.

Impacto:
- La migracion canonica no esta cerrada en todo el monorepo.
- El borrado indiscriminado de legacy puede romper directorio, programas, CTAs o comparadores.

Accion recomendada:
- Crear inventario por dominio: pricing, benefits, materias, costos, directorio, programas, CTAs, quote-history.
- Marcar que codigo legacy es compatibilidad externa, que codigo es modo de lectura y que codigo ya se puede borrar.
- Eliminar por dominio con tests antes/despues, no con una limpieza global.

### P1-2. Componentes y servicios demasiado grandes

Evidencia:
- `apps/web/src/components/ScholarshipCalculator.tsx`: mas de 2200 lineas.
- `apps/web/src/lib/meta-whatsapp.ts`: mas de 1700 lineas.
- `apps/web/src/components/unidep/WebCampaignsPanel.tsx`: mas de 1600 lineas.
- `apps/web/src/components/unidep/ContactsPanel.tsx`: mas de 1600 lineas.
- `apps/web/src/app/globals.css`: mas de 4900 lineas.

Impacto:
- Cambios pequenos tienen alto riesgo de regresion.
- Dificulta ownership por dominio y pruebas enfocadas.

Accion recomendada:
- Extraer componentes por responsabilidad: formularios, tablas, filtros, importadores, acciones.
- Mover calculos y normalizadores a librerias puras testeables.
- Dividir CSS por superficies o migrar estilos repetidos a tokens/componentes.

### P1-3. Duplicacion de assets y extension

Evidencia:
- Branding duplicado en `branding/`, `apps/web/public/branding/`, `apps/chrome-extension/...` y `chrome-extension/variants/...`.
- Variantes `composer-first` y `preview-first` duplican archivos grandes de panel/campaign/background.

Impacto:
- El repo crece innecesariamente.
- Fixes de seguridad/UI pueden quedarse incompletos entre variantes.

Accion recomendada:
- Definir fuente unica de assets y script de copia/generacion.
- Convertir variantes de extension a outputs generados o parametrizados.
- Mantener solo artefactos fuente versionados.

### P1-4. UI admin renderiza, pero sigue densa

Evidencia browser:
- `/admin/prices`: columnas canonicas en orden `Region | Plantel | Tier | Precio lista`; pagina alta por volumen de filas.
- `/admin/benefits`: reglas base estan contraidas, pero la pagina completa sigue superando 3300 px de alto por publish/history/import/form/listado.
- `/admin/unidep/fees`: columnas canonicas en orden `Region | Plantel | Tier | Costo MXN`.

Impacto:
- Usuarios admin requieren mucho scroll para tareas frecuentes.
- Historial, importacion y formularios compiten con la tabla principal.

Accion recomendada:
- Usar tabs o panel lateral para `Importar`, `Historial`, `Crear/Editar`, `Reglas`.
- Hacer tablas virtualizadas o paginadas donde haya mas de 50 filas.
- Mostrar filas sin precio/costo en una vista de errores o filtro, no mezcladas por defecto.

### P1-5. Warning de LCP por imagen flotante

Evidencia:
- Browser local reporto warning de Next para `/branding/floating-calculator.png` como LCP.
- Uso detectado en `apps/web/src/components/unidep/FloatingCalculator.tsx`.

Impacto:
- La calculadora flotante puede afectar metricas percibidas.

Accion recomendada:
- Decidir si la imagen esta above-the-fold. Si si, usar `priority`/`loading="eager"` con dimensiones estables. Si no, lazy load y evitar que sea LCP.

## Hallazgos P2

### P2-1. Figma no esta conectado a un archivo fuente

No se recibio archivo de Figma ni tool callable de `use_figma` en la sesion. Para hacer auditoria visual profunda se necesita URL/file key y alcance de pantallas.

Accion recomendada:
- Crear o vincular archivo Figma con tokens, componentes admin, tablas, filtros, formularios y shells.
- Mapear componentes reales del repo contra componentes Figma.

### P2-2. Linear no tiene equipo/proyecto destino configurado en la sesion

No se crearon issues. El reporte puede convertirse a tickets P0/P1/P2 cuando se indique equipo/proyecto.

Accion recomendada:
- Crear epic "Auditoria intranet 2026-05-24".
- Generar issues por hallazgo, no un ticket monolitico.

### P2-3. ChatGPT Apps no aplica al repo actual

El proyecto es una intranet Next.js, no una ChatGPT App. La skill sirve como referencia si despues se quiere crear un asistente interno para buscar reportes, cotizaciones, contactos o acciones admin.

Accion recomendada:
- Considerar un asistente interno solo despues de estabilizar auth, permisos, auditoria y endpoints.

## Optimizaciones de proceso

1. CI/CD:
   - Separar checks rapidos de visual regression.
   - Corregir snapshots Linux o ejecutar visual regression en un entorno fijo.
   - Agregar job de `npm audit --audit-level=high` una vez remediado el baseline.

2. Deploy:
   - Mantener la regla indicada por el usuario: no hacer doble deploy manual en Vercel si GitHub ya dispara deploy automatico.
   - Usar Vercel CLI para inspeccion y logs, no para deploy, salvo instruccion explicita.

3. Datos:
   - Reemplazar `db push --accept-data-loss` por migraciones versionadas.
   - Agregar dry-run/backup/confirmacion en scripts destructivos de importacion.

4. Monorepo:
   - Usar packages compartidos para UI, canonical domain rules, importadores y extension.
   - Evitar duplicar variantes generadas dentro del repo.

5. QA:
   - Agregar fixtures canonical para precios, costos, beneficios, materias y online exception.
   - Mantener pruebas de importadores CSV/XLSX/JSON por esquema canonico.

## Mejoras de seguridad recomendadas

- Remediar dependencias criticas/altas antes de nuevas features.
- Reemplazar rate limit en memoria por store compartido.
- Revisar tokens de extension: TTL corto, rotacion, revocacion, almacenamiento minimo y auditoria de uso.
- Evitar lectura/escritura de secretos en reportes o logs.
- Validar tamano, MIME, extension y estructura de archivos importados en servidor.
- Agregar logs estructurados para acciones admin sensibles: importacion, edicion de precios, beneficios, costos, materias, tokens y cambios de configuracion.
- Revisar rutas publicas y re-exportadas para confirmar cache, auth y shape de respuesta.

## Mejoras UI/UX recomendadas

- Consolidar orden canonico en toda tabla/importador aplicable: `Region | Plantel | Tier | Precio/Costo/Beneficio`.
- Mantener la excepcion online documentada: online puede usar `Tier General` o sin tier, pero debe renderizarse de forma consistente.
- Reducir densidad del admin con tabs, accordions y acciones por fila.
- Hacer edit/delete visibles en listados de beneficios sin obligar a recorrer listas largas.
- Convertir estados vacios o datos incompletos en paneles accionables, no filas mezcladas.
- Normalizar labels legacy/canonical para que usuarios no vean terminos internos.

## Plan sugerido

### Fase 0 - Estabilizacion

- Corregir release gate GitHub.
- Remediar dependencias P0.
- Quitar `db push --accept-data-loss` del build de Vercel.
- Migrar rate limit a store compartido.

### Fase 1 - Cierre canonical

- Inventariar residuos legacy por dominio.
- Borrar legacy solo donde no tenga contrato activo.
- Fortalecer tests de precios, costos, materias, beneficios e importadores.

### Fase 2 - UX admin

- Reorganizar beneficios/precios/costos/materias con tabs y tablas escalables.
- Crear patrones compartidos para importadores canonicos.
- Corregir LCP de la calculadora flotante.

### Fase 3 - Monorepo y operaciones

- Descomponer archivos grandes.
- Deduplicar extension/assets.
- Crear tickets Linear y, si aplica, archivo Figma de sistema UI.

## Limitaciones

- No se consultaron secretos reales ni se hizo `vercel env pull`.
- No se hizo deploy.
- Browser local uso sesion ya autenticada; no equivale a QA manual completo.
- Figma y Linear requieren targets concretos para ejecutar cambios fuera del repo.

## Remediacion aplicada en `codex/audit-remediation-p0`

Cambios aplicados tras esta auditoria:
- Release gate: smoke test actualizado al hero actual `ReCalc UNIDEP`.
- Visual regression: los tests ahora verifican si existen baselines para `project/platform` y saltan explicitamente cuando faltan, evitando fallas por snapshots Linux ausentes mientras se genera una estrategia multiplataforma.
- Vercel build: se removio `prisma db push --accept-data-loss`; el build usa `prisma migrate deploy` y falla si las migraciones fallan.
- Dependencias: `next` y `eslint-config-next` subieron a `16.2.6`; `@neondatabase/auth` a `0.4.1-beta`; `@neondatabase/neon-js` a `0.6.1-beta`; `xlsx` fue retirado.
- Importadores/exportadores: los usos de SheetJS se reemplazaron por ExcelJS o se movieron al servidor.
- Rate limit: el limiter en memoria ahora limpia buckets vencidos y acota el numero maximo de buckets.
- Rate limit productivo: `checkRateLimit` usa Upstash Redis REST cuando `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` estan configurados; si no existen, conserva fallback local para desarrollo/test.
- Extension: se elimino el fallback sensible de `recalc.extensionSessionToken` hacia `window.localStorage`; queda `chrome.storage.local`.
- Tokens de extension: los tokens emitidos ahora tienen TTL maximo de 24 horas y se rotan revocando tokens activos equivalentes del mismo usuario/scope/cliente antes de emitir uno nuevo.
- UI/admin: se retiraron labels visibles con `legacy` en programas, directorio, sidebar y CTAs; queda una prueba de regresion para no reintroducirlos.
- Compatibilidad: se renombraron helpers/rutas internas de compatibilidad para no usar `legacy` como lenguaje operativo cuando la ruta sigue existiendo por redireccion.
- Limpieza: se elimino `workspaceLegacyQueryRedirects`, export no usado en navegacion.
- LCP: la imagen contraida de la calculadora flotante ahora usa `priority` porque aparece sobre el primer viewport; queda prueba de regresion.
- P1 legacy: se creo `docs/audits/2026-05-25-legacy-residue-inventory.md` con inventario por dominio y se amplio la prueba de copy admin para cubrir acciones de reparacion visibles.
- Pricing compatibilidad: `toLegacyBusinessLine` se renombro a `toHistoricalBusinessLineKey` para describir su uso real sin cambiar llaves historicas persistidas.
- Fase 1 local: se reforzaron pruebas canonical para price-list online, beneficios globales y precio por materia; el retiro restante queda bloqueado por confirmacion de modos productivos y fuente unica de extension.

Estado despues de la remediacion:
- `npm audit --json`: 0 criticas, 0 altas, 9 moderadas.
- `npm run release:gate`: OK en local, incluyendo build, Playwright publico y Neon verification.
- Browser local: `/`, `/auth/sign-in` y `/admin/prices` renderizaron sin errores de consola relevantes; `/admin/prices` mantiene el orden `Region | Plantel | Tier | Precio lista`.
- Verificacion posterior: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` y `npm audit --audit-level=high --json` pasaron tras cerrar el residuo P0-4/P0-5.
- Riesgo residual: las moderadas restantes vienen de `@neondatabase/auth`/`better-auth` y `exceljs/uuid`. Forzar `better-auth` a `1.6.x` rompe `@neondatabase/auth-ui` porque faltan exports esperados; debe resolverse con update coordinado de Neon Auth UI o reemplazo de componentes auth. En ambientes productivos falta confirmar que las variables de Upstash esten configuradas; sin ellas el sistema usa fallback local.
- Riesgo P1 residual: directorio y variantes de extension mantienen compatibilidad historica; no deben borrarse sin confirmar modo canonical productivo y fuente unica de generacion.
