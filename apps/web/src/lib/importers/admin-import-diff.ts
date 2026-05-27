export type ImportDiffExample = {
  kind: "added" | "updated" | "removed";
  key: string;
  label: string;
};

export type ImportDiffSummary = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  totalCompared: number;
  examples: ImportDiffExample[];
  notes: string[];
};

type DiffItem = {
  key: string;
  label: string;
  value: unknown;
};

const MAX_EXAMPLES = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function labelFromRecord(record: Record<string, unknown>, fallback: string) {
  const candidates = [
    record.label,
    record.name,
    record.nombre,
    record.programa,
    record.program,
    record.key,
    record.id,
  ]
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : ""))
    .filter(Boolean);

  return candidates[0] ?? fallback;
}

function keyFromRecord(scope: string, record: Record<string, unknown>, index: number) {
  const rawId = record.id ?? record.key ?? record.code ?? record.slug ?? null;
  if (typeof rawId === "string" || typeof rawId === "number") {
    return `${scope}:${String(rawId)}`;
  }

  const composite = [
    record.scope,
    record.aliasType,
    record.type,
    record.cycle,
    record.plantel,
    record.campusId,
    record.programId,
    record.programaKey,
    record.nivelKey,
    record.modalidadKey,
    record.plan,
    record.tier,
    record.enrollmentType,
    record.businessLine,
    record.modality,
    record.campusTier,
    record.minAverage,
    record.maxAverage,
  ]
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : ""))
    .filter(Boolean)
    .join(":" );

  if (composite) return `${scope}:${composite}`;
  return `${scope}:row:${index}:${stableStringify(record).slice(0, 96)}`;
}

function arrayToItems(scope: string, value: unknown): DiffItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    if (isRecord(item)) {
      return {
        key: keyFromRecord(scope, item, index),
        label: labelFromRecord(item, `${scope} #${index + 1}`),
        value: item,
      };
    }

    return {
      key: `${scope}:value:${index}:${stableStringify(item)}`,
      label: `${scope} #${index + 1}`,
      value: item,
    };
  });
}

function snapshotToItems(value: unknown, rootScope: string): DiffItem[] {
  if (Array.isArray(value)) return arrayToItems(rootScope, value);
  if (!isRecord(value)) return [];

  const directArrays = Object.entries(value).flatMap(([scope, entry]) => arrayToItems(scope, entry));
  if (directArrays.length > 0) return directArrays;

  return Object.entries(value).map(([key, entry]) => ({
    key: `${rootScope}:${key}`,
    label: key,
    value: entry,
  }));
}

function buildExamples(input: {
  added: DiffItem[];
  updated: DiffItem[];
  removed: DiffItem[];
}): ImportDiffExample[] {
  const examples: ImportDiffExample[] = [];
  const push = (kind: ImportDiffExample["kind"], items: DiffItem[]) => {
    for (const item of items) {
      if (examples.length >= MAX_EXAMPLES) return;
      examples.push({ kind, key: item.key, label: item.label });
    }
  };

  push("added", input.added);
  push("updated", input.updated);
  push("removed", input.removed);
  return examples;
}

export function buildImportDiffSummary(input: {
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  preview: unknown;
  result: unknown;
}): ImportDiffSummary {
  const beforeItems = snapshotToItems(input.beforeSnapshot, "before");
  const afterItems = snapshotToItems(input.afterSnapshot, "after");
  const previewItems = snapshotToItems(input.preview, "preview");

  const comparisonItems = afterItems.length > 0 ? afterItems : previewItems;
  const beforeMap = new Map(beforeItems.map((item) => [item.key, item]));
  const afterMap = new Map(comparisonItems.map((item) => [item.key, item]));
  const allKeys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();

  const addedItems: DiffItem[] = [];
  const updatedItems: DiffItem[] = [];
  const removedItems: DiffItem[] = [];
  let unchanged = 0;

  for (const key of allKeys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);

    if (!before && after) {
      addedItems.push(after);
      continue;
    }

    if (before && !after) {
      removedItems.push(before);
      continue;
    }

    if (!before || !after) continue;

    if (stableStringify(before.value) === stableStringify(after.value)) {
      unchanged += 1;
    } else {
      updatedItems.push(after);
    }
  }

  const notes = [
    afterItems.length > 0
      ? "Diff semántico calculado comparando beforeSnapshot contra afterSnapshot."
      : "Diff semántico calculado comparando beforeSnapshot contra el preview, porque la sesión aún no tiene afterSnapshot.",
    "Las llaves usan id cuando existe; si no, se usa una llave compuesta con campos de negocio disponibles.",
  ];

  if (beforeItems.length === 0 && comparisonItems.length === 0) {
    notes.push("No se detectaron snapshots o preview con estructura comparable para esta sesión.");
  }

  return {
    added: addedItems.length,
    updated: updatedItems.length,
    removed: removedItems.length,
    unchanged,
    totalCompared: allKeys.length,
    examples: buildExamples({ added: addedItems, updated: updatedItems, removed: removedItems }),
    notes,
  };
}
