# Scripts Inventory

**Última actualización:** 2026-03-12  
**Estado:** vigente  
**Convención de nombres:** kebab-case para scripts con alias npm; snake_case sólo para scripts Python sin alias y para el helper `_neon_env.py`.

---

## Resumen de scripts oficiales

| Script | Alias npm | Descripción |
|--------|-----------|-------------|
| `vercel-build.sh` | `vercel-build` | Build de Vercel: resuelve `DATABASE_URL`/`DIRECT_URL` y ejecuta `prisma db push`. |
| `bootstrap-admin.js` | `admin:bootstrap` | Crea el usuario administrador inicial. |
| `seed-campuses.js` | `campus:seed` | Siembra el catálogo canónico de campus (25 presenciales + 1 online) en `recalc_admin.campus` vía Prisma. |
| `import-output.ts` | `import:output` | Punto de entrada TypeScript que delega en `import-output.js`. |
| `import-output.js` | _(impl)_ | Importador académico principal. Lee el output XLSX y actualiza las tablas canónicas. No modifica `AdminPriceOverride`. |
| `backup-legacy-data.ts` | `backup:legacy` | Exporta datos del esquema legacy a JSON para backup antes de migrar. |
| `backfill-canonical-data.ts` | `canonical:backfill` | Rellena el esquema canónico (Prisma) con datos copiados desde legacy. Parte del flujo de migración `legacy → canonical`. |
| `compare-canonical-data.ts` | `canonical:compare` | Compara datos entre legacy y canonical y reporta divergencias. Usar junto con `PRICING_READ_MODE=compare`. |
| `release-gate.ts` | `release:gate` | Valida criterios de calidad (ESLint, TypeScript, tests) antes de promover a producción. |
| `local-code-review.sh` | _(manual)_ | Ejecuta los mismos checks de calidad del workflow CI de forma local. |
| `promote.sh` | `promote` _(posix)_ | Promueve la rama actual a producción vía merge. |
| `promote.ps1` | `promote` _(win)_ | Versión PowerShell del script de promoción. |
| `seed_neon.js` | `seed:neon` | Siembra datos base en la base de datos Neon durante el setup inicial. |
| `verify_neon.js` | `verify:neon` | Verifica la conectividad y estructura básica de la base de datos Neon. |
| `prisma-env.js` | _(util)_ | Resuelve variables de entorno de Prisma en entornos sin `.env` explícito. |
| `_neon_env.py` | _(util)_ | Helper Python: resuelve `SQL_URL` y `NEON_CONN` para scripts que usan el HTTP SQL API de Neon. |

---

## Scripts de migración HTTP (Python / mjs)

Estos scripts operan directamente contra el endpoint HTTP SQL de Neon, sin requerir conexión TCP. Se usan durante el setup inicial o en entornos donde Prisma no tiene acceso directo.

| Script | Descripción |
|--------|-------------|
| `apply_migrations_http.py` | Aplica migraciones SQL al endpoint HTTP de Neon. |
| `run-migrations-http.mjs` | Aplica migraciones vía HTTP usando módulos ES. |
| `run-migrations-curl.sh` | Aplica migraciones vía `curl` al endpoint Neon. Alternativa para entornos sin Node/Python. |
| `migrate.py` | Orquestador de migraciones Python para entornos Neon. |
| `seed-campuses-http.py` | Siembra `recalc_admin.campus` (25 campus) vía HTTP SQL. Alternativa sin Prisma para entornos sin conexión TCP. |
| `seed-public-http.py` | Crea tablas del esquema público (`recalc_*`) y las siembra vía HTTP SQL. |
| `apply-cta-migration.mjs` | Migración puntual para tabla de CTAs. |
| `apply-user-capability-migration.mjs` | Migración puntual para capacidades de usuario. |

---

## Scripts de branding

| Script | Descripción |
|--------|-------------|
| `generate-branding-assets.ps1` | Genera assets de branding (logos, favicons) en Windows. |

---

## Scripts eliminados / deprecados

Los siguientes scripts han sido **eliminados** en este bloque por ser duplicados del script canónico equivalente:

| Script eliminado | Script canónico | Motivo |
|-----------------|-----------------|--------|
| `scripts/seed_campuses_http.py` | `scripts/seed-campuses-http.py` | Duplicado con diferente convención de nombres (snake_case). El canónico usa kebab-case, consistente con el resto del proyecto. |
| `scripts/seed_public_http.py` | `scripts/seed-public-http.py` | Ídem anterior. |

---

## Flujo operativo recomendado por categoría

### Setup inicial (primera vez)
```
1. node scripts/seed_neon.js           (seed:neon)
2. npx prisma db push                  (schema sync)
3. node scripts/bootstrap-admin.js    (admin:bootstrap)
4. node scripts/seed-campuses.js      (campus:seed)
```

### Migración legacy → canonical
```
1. tsx scripts/backup-legacy-data.ts       (backup:legacy)
2. tsx scripts/backfill-canonical-data.ts  (canonical:backfill)
3. # Activar PRICING_READ_MODE=compare / DIRECTORY_READ_MODE=compare
4. tsx scripts/compare-canonical-data.ts   (canonical:compare)
5. # Validar paridad y cambiar a =canonical
```

### Importación de oferta académica
```
tsx scripts/import-output.ts  (import:output)
# Requiere el archivo de output XLSX en ~/Desktop/_output o la variable OUTPUT_BASE
```

### Release / calidad
```
tsx scripts/release-gate.ts   (release:gate)
./scripts/local-code-review.sh
```

### Entornos sin conexión TCP a Neon
```
python3 scripts/seed-campuses-http.py   # campus
python3 scripts/seed-public-http.py     # esquema público
python3 scripts/apply_migrations_http.py / node scripts/run-migrations-http.mjs
```

---

## Notas de mantenimiento

- Todos los scripts con alias npm son los oficiales. Preferir `npm run <alias>` sobre ejecución directa.
- Los scripts Python que usan el HTTP API de Neon dependen de `scripts/_neon_env.py`.
- `import-output.ts` es el punto de entrada TypeScript; `import-output.js` contiene la lógica real. No duplicar en TypeScript.
- Ver `docs/ROUTING_MODES_REFERENCE.md` para la guía de variables `*_READ_MODE` y `*_WRITE_MODE` durante la migración.
