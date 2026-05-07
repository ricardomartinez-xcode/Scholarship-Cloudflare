# Import / Export V2

## Auditoría actual

### Importación existente
- Import de precios CSV: `src/lib/importers/prices-csv.ts` + rutas `src/app/api/admin/prices/import/**`.
- Import de beneficios CSV: `src/lib/importers/benefits-csv.ts` + rutas `src/app/api/admin/benefits/import/**`.
- Import de oferta académica: `src/lib/importers/academic-offer.ts` + rutas `src/app/api/admin/import-academic-offer/**`.

### Exportación existente
- No hay un dominio dedicado unificado para exportes CSV/XLSX/PDF de reportes admin.

## Implementación V2 parcial

### Nuevo dominio de import
- `src/domains/import-export/import/types.ts`
- `src/domains/import-export/import/parser.ts` (CSV + XLSX)
- `src/domains/import-export/import/validator.ts`
- `src/domains/import-export/import/mapper.ts`
- `src/domains/import-export/import/importer-service.ts`
- `src/domains/import-export/import/import-job-service.ts`
- `src/domains/import-export/import/import-report.ts`

### Nuevo dominio de export
- `src/domains/import-export/export/report-service.ts`
- `src/domains/import-export/export/csv-exporter.ts`
- `src/domains/import-export/export/xlsx-exporter.ts`
- `src/domains/import-export/export/pdf-exporter.ts` (pendiente estable)
- `src/domains/import-export/export/filters.ts`

## Límites / notas
- PDF queda explícitamente marcado como pendiente.
- El wiring completo de UI para vista previa/cancelación se mantiene en backlog para evitar regresión.
