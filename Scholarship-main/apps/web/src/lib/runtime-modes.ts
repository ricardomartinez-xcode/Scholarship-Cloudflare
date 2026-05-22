/**
 * RuntimeMode — modo de ejecución para subsistemas con implementación dual.
 *
 * Soporta migración gradual de la fuente de datos legacy (tablas `recalc_*`)
 * a la implementación canónica (Prisma ORM con esquema normalizado):
 *
 *  - "legacy"    Usa solo la implementación legacy. Valor por defecto.
 *  - "compare"   Ejecuta ambas implementaciones, registra diferencias en logs
 *                (prefijo `[canonical-compare]`) y, en la mayoría de subsistemas,
 *                devuelve el resultado legacy. En subsistemas canonical-first
 *                (por ejemplo QUOTE_MODE para /api/data/quote) devuelve el resultado
 *                canónico y usa legacy solo para auditoría/comparación.
 *                Sirve para validar paridad antes de promover a canonical.
 *  - "canonical" Usa solo la implementación canónica. Destino final de la migración.
 *
 * Variables de entorno asociadas:
 *  - PRICING_READ_MODE      → reglas de beca, precios por materia, meta
 *  - DIRECTORY_READ_MODE    → directorio público de contactos
 *  - DIRECTORY_WRITE_MODE   → escritura y sincronización de métodos de contacto
 *  - QUOTE_MODE             → cálculo de cotización (el endpoint /api/data/quote
 *                             es canonical-first; este modo solo activa el logging
 *                             de comparación cuando se establece en "compare")
 *
 * Ver docs/ROUTING_MODES_REFERENCE.md para el mapa completo de rutas y el
 * camino de migración recomendado.
 */
export type RuntimeMode = "legacy" | "compare" | "canonical";

const VALID_RUNTIME_MODES = new Set<RuntimeMode>([
  "legacy",
  "compare",
  "canonical",
]);

function readRuntimeMode(
  value: string | undefined,
  fallback: RuntimeMode = "legacy",
): RuntimeMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VALID_RUNTIME_MODES.has(normalized as RuntimeMode)
    ? (normalized as RuntimeMode)
    : fallback;
}

/** Controla la fuente de datos para reglas de beca y precios. */
export const getPricingReadMode = () =>
  readRuntimeMode(process.env.PRICING_READ_MODE);

/** Controla la fuente de datos para el directorio público de contactos. */
export const getDirectoryReadMode = () =>
  readRuntimeMode(process.env.DIRECTORY_READ_MODE);

/**
 * Controla la escritura en el directorio de contactos.
 * En modo "canonical" también sincroniza los métodos de contacto
 * (DirectoryContactMethod); en modos legacy/compare no los sincroniza.
 */
export const getDirectoryWriteMode = () =>
  readRuntimeMode(process.env.DIRECTORY_WRITE_MODE);

/**
 * Controla el modo de cotización.
 * Nota: /api/data/quote es canonical-first — siempre ejecuta resolveScholarshipQuote.
 * Este modo solo activa el logging de comparación con el motor legacy cuando
 * se establece en "compare".
 */
export const getQuoteMode = () => readRuntimeMode(process.env.QUOTE_MODE);

/**
 * Devuelve true cuando las escrituras admin deben duplicarse también en las
 * tablas legacy de precios (recalc_*). Se vuelve false solo en modo canonical.
 */
export const shouldMirrorLegacyPricingWrites = () =>
  getPricingReadMode() !== "canonical";

/**
 * Devuelve true cuando las escrituras admin deben duplicarse también en las
 * tablas legacy del directorio. Se vuelve false solo en modo canonical.
 */
export const shouldMirrorLegacyDirectoryWrites = () =>
  getDirectoryWriteMode() !== "canonical";
