/**
 * RuntimeMode — modo de ejecución para subsistemas que todavía admiten
 * validación dual fuera del cotizador.
 *
 *  - "legacy"    Usa solo la implementación legacy. Solo para ventanas de auditoría.
 *  - "compare"   Ejecuta ambas implementaciones, registra diferencias en logs
 *                (prefijo `[canonical-compare]`) y, en la mayoría de subsistemas,
 *                devuelve el resultado legacy. En subsistemas canonical-first
 *                (por ejemplo QUOTE_MODE para /api/data/quote) devuelve el resultado
 *                canónico y usa legacy solo para auditoría/comparación.
 *                Sirve para validar paridad antes de promover a canonical.
 *  - "canonical" Usa solo la implementación canónica. Valor por defecto.
 *
 * Variables de entorno asociadas:
 *  - PRICING_READ_MODE      → reglas de beca, precios por materia, meta.
 *                             Siempre resuelve a canonical; otros valores
 *                             se ignoran para exponer faltantes canónicos.
 *  - DIRECTORY_READ_MODE    → directorio público de contactos
 *  - DIRECTORY_WRITE_MODE   → escritura y sincronización de métodos de contacto
 *  - QUOTE_MODE             → cálculo de cotización. Siempre resuelve a canonical.
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
  fallback: RuntimeMode = "canonical",
): RuntimeMode {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VALID_RUNTIME_MODES.has(normalized as RuntimeMode)
    ? (normalized as RuntimeMode)
    : fallback;
}

/** Controla la fuente de datos para reglas de beca y precios. */
export const getPricingReadMode = () => "canonical" as const;

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
 * Controla el modo de cotización. El cotizador siempre usa canonical.
 */
export const getQuoteMode = () => "canonical" as const;

/**
 * Devuelve true cuando las escrituras admin de precios deben duplicarse a una
 * segunda fuente. Para pricing siempre queda apagado.
 */
export const shouldMirrorLegacyPricingWrites = () =>
  false;

/**
 * Devuelve true cuando las escrituras admin deben duplicarse también en las
 * tablas legacy del directorio. Se vuelve false solo en modo canonical.
 */
export const shouldMirrorLegacyDirectoryWrites = () =>
  getDirectoryWriteMode() !== "canonical";
