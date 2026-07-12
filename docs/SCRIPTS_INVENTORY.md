# Scripts Inventory

**Última actualización:** 2026-07-12
**Estado:** vigente
**Convención de nombres:** kebab-case para scripts con alias npm; snake_case solo
en herramientas historicas aisladas bajo `legacy/`.

---

## Resumen de scripts oficiales

| Script | Alias npm | Descripción |
|--------|-----------|-------------|
| `vercel-build.sh` | `vercel-build` | Alias de compatibilidad que ejecuta el build Next.js; no aplica migraciones. |
| `bootstrap-admin.js` | `admin:bootstrap` | Crea el usuario administrador inicial. |
| `seed-campuses.js` | `campus:seed` | Siembra el catálogo canónico de campus (25 presenciales + 1 online) en `recalc_admin.campus` vía Prisma. |
| `import-output.ts` | `import:output` | Punto de entrada TypeScript que delega en `import-output.js`. |
| `import-output.js` | _(impl)_ | Importador académico principal. Lee el output XLSX y actualiza las tablas canónicas. No modifica `AdminPriceOverride`. |
| `release-gate.ts` | `release:gate` | Valida criterios de calidad (ESLint, TypeScript, tests) antes de promover a producción. |
| `local-code-review.sh` | _(manual)_ | Ejecuta los mismos checks de calidad del workflow CI de forma local. |
| `promote.sh` | `promote` _(posix)_ | Promueve la rama actual a producción vía merge. |
| `promote.ps1` | `promote` _(win)_ | Versión PowerShell del script de promoción. |
| `prisma-env.js` | _(util)_ | Resuelve variables de entorno de Prisma en entornos sin `.env` explícito. |

---

## Scripts Neon retirados

Los helpers HTTP, seeds, verificaciones, migraciones puntuales y el workflow de
limpieza de la base Neon anterior estan bajo `legacy/neon-database/`. No tienen
alias npm, no forman parte de `.github/workflows`, no se instalan en Vercel y no
deben ejecutarse sin un plan de rollback revisado.

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
1. Aplicar supabase/migrations exclusivamente al proyecto staging revisado
2. npm run admin:bootstrap
3. npm run campus:seed
4. npm run migration:validate-data -- --remote
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

## Notas de mantenimiento

- Todos los scripts con alias npm son los oficiales. Preferir `npm run <alias>` sobre ejecución directa.
- No usar `prisma db push` para ambientes compartidos o producción; aplicar migraciones versionadas.
- Los scripts Neon Auth se retiraron a `legacy/neon-auth/scripts/` y no tienen alias npm.
- Los scripts Neon PostgreSQL se retiraron a `legacy/neon-database/scripts/`.
- `import-output.ts` es el punto de entrada TypeScript; `import-output.js` contiene la lógica real. No duplicar en TypeScript.
- Ver `docs/ROUTING_MODES_REFERENCE.md` para la guía de variables `*_READ_MODE` y `*_WRITE_MODE` durante la migración.
