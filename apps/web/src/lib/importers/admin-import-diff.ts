export type ImportDiffSummary = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  totalCompared: number;
  notes: string[];
};

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export function buildImportDiffSummary(input: {
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  preview: unknown;
  result: unknown;
}): ImportDiffSummary {
  const beforeCount = countArray(input.beforeSnapshot);
  const afterCount = countArray(input.afterSnapshot);
  const previewCount = countArray(input.preview);

  const added = Math.max(afterCount - beforeCount, 0);
  const removed = Math.max(beforeCount - afterCount, 0);

  let updated = 0;
  if (previewCount > 0 && beforeCount > 0) {
    updated = Math.min(previewCount, beforeCount);
  }

  const unchanged = Math.max(afterCount - added - updated, 0);

  return {
    added,
    updated,
    removed,
    unchanged,
    totalCompared: Math.max(beforeCount, afterCount, previewCount),
    notes: [
      "Preview de diff preliminar generado desde snapshots y preview de importación.",
      "Las próximas iteraciones incluirán diff campo por campo y detección semántica por llave de negocio.",
    ],
  };
}
