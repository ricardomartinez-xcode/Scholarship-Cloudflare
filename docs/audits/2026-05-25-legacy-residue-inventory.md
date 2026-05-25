# Inventario de residuos legacy - 2026-05-25

Alcance: seguimiento P1-1 de `docs/audits/2026-05-24-monorepo-intranet-audit.md`.
Este inventario separa compatibilidad necesaria de residuos candidatos a retiro.

## Criterios

- **Compatibilidad externa**: rutas, campos o valores que pueden estar usados por enlaces, clientes o datos historicos. No borrar sin ventana de retiro.
- **Lectura dual/auditoria**: codigo que compara implementaciones o mantiene paridad durante migracion. Puede quedarse si tiene test y fecha de reevaluacion.
- **Candidato a retiro**: codigo sin contrato activo aparente o lenguaje interno visible para operadores.

## Inventario por dominio

| Dominio | Archivos | Clasificacion | Estado | Siguiente accion |
| --- | --- | --- | --- | --- |
| Pricing/cotizador | `apps/web/src/lib/runtime-modes.ts`, `apps/web/src/app/api/ext/quote/route.test.ts` | Lectura dual/auditoria | El cotizador fuerza canonical; las referencias legacy quedan como prueba de no regresion y documentacion de modos. | Mantener tests; no reactivar `QUOTE_MODE=legacy`. |
| Beneficios/precios base | `apps/web/src/lib/base-price-overrides.ts`, `apps/web/src/lib/__tests__/base-price-overrides.test.ts` | Compatibilidad de datos historicos | `toHistoricalBusinessLineKey` traduce llaves historicas de snapshots publicados sin reactivar rutas anteriores. | Mantener compatibilidad de llaves persistidas y pruebas enfocadas antes de retirar snapshots antiguos. |
| Directorio publico | `apps/web/src/app/api/public/directorio/route.ts`, `apps/web/src/app/(admin)/admin/(protected)/unidep/directory/actions.ts`, `apps/web/src/lib/runtime-modes.ts` | Lectura dual/auditoria | Mantiene modo canonical/compare/anterior para validar paridad de `DirectoryContactMethod`. | No borrar hasta confirmar que `DIRECTORY_READ_MODE` y `DIRECTORY_WRITE_MODE` estan en canonical en produccion. |
| Programas admin | `apps/web/src/app/(admin)/admin/(protected)/unidep/programs/ProgramsClient.tsx` | Cerrado visualmente | Ya no expone labels `Nivel legacy` ni `Agrupador legacy`; cubierto por `admin-ui-copy.test.ts`. | Mantener prueba de copy. |
| CTAs/admin repair | `apps/web/src/services/repairActionsService.ts` | Candidato a retiro parcial | Se retiro lenguaje `legacy` de textos operativos visibles; quedan identificadores internos y mapeos historicos. | Mantener copy sin terminos internos; evaluar retiro de location historica cuando todos los CTAs tengan placement canonical. |
| Extension/assets | `apps/chrome-extension/recalc-sidepanel`, `chrome-extension/variants/preview-first` | Duplicacion P1-3 | Se retiro `composer-first`; `preview-first` queda como unica variante activa y sus archivos exact-copy tienen fuente canonica y sync verificable. | Parametrizar archivos especificos de variante antes de retirar mas duplicacion. |
| Migraciones Prisma | `packages/db/prisma/migrations/*` | Historico inmutable | Referencias legacy en migraciones son registro historico. | No editar migraciones aplicadas. |
| Documentacion operativa | `docs/ROUTING_MODES_REFERENCE.md`, `docs/QUALITY_RELEASE_GATES.md`, roadmaps historicos | Documentacion | Contiene lenguaje legacy para explicar compatibilidad y retiro. | Actualizar cuando se cierre cada dominio; no borrar evidencia historica. |

## Cambios aplicados en este pase

- Se agrego `apps/web/src/services/repairActionsService.ts` a la prueba de copy admin para evitar lenguaje de migracion en acciones visibles.
- Se reemplazaron textos operativos con `legacy` por `anterior`/`ubicacion anterior`.
- Se fortalecieron pruebas canonical de price-list online, beneficios globales, y altas/ediciones/bajas de precio por materia.
- No se tocaron `.env*`, migraciones aplicadas ni contratos de API.

## Cierre Fase 1 local

La Fase 1 queda cerrada para el alcance verificable localmente:

- Residuos legacy inventariados por dominio.
- Lenguaje interno de migracion fuera de copy admin visible.
- Helpers de pricing renombrados a compatibilidad historica sin cambiar llaves persistidas.
- Tests reforzados para precios, beneficios, materias/costos e importadores canonicos.

## Pendientes bloqueados por decision/entorno

1. Confirmar modos de directorio en produccion antes de retirar lectura dual.
2. Parametrizar `background.js`, `campaigns.js`, `content-whatsapp.js`, `manifest.json`, `panel.js` y archivos de WhatsApp especificos de `preview-first` antes de retirar mas duplicacion.

## Inicio Fase 3

La Fase 3 arranco por extension/assets:

- `scripts/extension-variant-config.mjs` define la fuente canonica y la lista de archivos exact-copy gestionados.
- `npm run extension:sync` copia esos archivos desde `apps/chrome-extension/recalc-sidepanel` hacia la variante activa `preview-first`.
- `npm run extension:verify` usa la misma configuracion para detectar drift.
- `chrome-extension/variants/composer-first` fue eliminado; `preview-first` queda como unica version de extension versionada.
- El retiro de mas duplicacion queda condicionado a parametrizar los archivos que todavia tienen comportamiento especifico de `preview-first`.

La Fase 3 tambien deja medicion reproducible para modularizacion:

- `npm run repo:large-files` lista fuentes grandes excluyendo artefactos generados como `.next`, `dist`, `coverage` y `node_modules`.
- El primer uso local mantiene como focos `apps/web/src/app/globals.css`, `ScholarshipCalculator.tsx`, `meta-whatsapp.ts`, paneles UNIDEP y archivos grandes de extension.
- `docs/audits/2026-05-25-large-source-files.md` registra el snapshot inicial y el orden recomendado de extraccion.
