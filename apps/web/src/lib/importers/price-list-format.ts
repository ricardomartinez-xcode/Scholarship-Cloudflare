import { normalizeHeader } from "@/lib/importers/csv-utils";

type PriceListCell = string | number | boolean | Date | null | undefined;

export type PriceListWorkbookSheet = {
  name: string;
  rows: PriceListCell[][];
};

export type PriceListWorkbook = {
  sheets: PriceListWorkbookSheet[];
};

export type NormalizedPriceListRow = {
  region: string | null;
  plantel: string | null;
  nivelKey: string;
  modalidadKey: string;
  plan: string;
  tier: string | null;
  newPrice: number;
  isActive: boolean;
  notes: string | null;
};

type SheetDefaults = {
  nivelKey: string;
  modalidadKeys: string[];
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function compact(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function readCell(row: PriceListCell[], index: number) {
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

function findColumn(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/[$\s]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTier(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw || raw === "ANY" || raw === "ONLINE" || raw === "OL") return null;
  const match = raw.match(/(?:TIER|T)\s*([0-9]+)/);
  return match ? `T${match[1]}` : raw;
}

function normalizeNivel(value: unknown) {
  const valueKey = normalizeText(value);
  if (valueKey.includes("bachiller") || valueKey.includes("prepa")) {
    return "preparatoria";
  }
  if (valueKey.includes("lic")) return "licenciatura";
  if (valueKey.includes("salud")) return "salud";
  if (
    valueKey.includes("posgrado") ||
    valueKey.includes("maestria") ||
    valueKey.includes("maestr")
  ) {
    return "maestria";
  }
  return String(value ?? "").trim().toLowerCase();
}

function normalizeModalidad(value: unknown) {
  const valueKey = normalizeText(value);
  if (valueKey.includes("online")) return "online";
  if (valueKey.includes("ejecut") || valueKey.includes("mixta")) return "mixta";
  if (valueKey.includes("escolar") || valueKey.includes("presencial")) {
    return "presencial";
  }
  return String(value ?? "").trim().toLowerCase();
}

function defaultsForSheet(sheetName: string): SheetDefaults | null {
  const key = normalizeText(sheetName);
  if (key.includes("bachillerato online")) {
    return { nivelKey: "preparatoria", modalidadKeys: ["online"] };
  }
  if (key.includes("bachillerato")) {
    return { nivelKey: "preparatoria", modalidadKeys: ["presencial", "mixta"] };
  }
  if (key.includes("lic") && key.includes("online")) {
    return { nivelKey: "licenciatura", modalidadKeys: ["online"] };
  }
  if (key.includes("lic") && key.includes("ejecut")) {
    return { nivelKey: "licenciatura", modalidadKeys: ["mixta"] };
  }
  if (key.includes("lic")) {
    return { nivelKey: "licenciatura", modalidadKeys: ["presencial"] };
  }
  if (key.includes("salud")) {
    return { nivelKey: "salud", modalidadKeys: ["presencial"] };
  }
  if (key.includes("posgrado")) {
    return { nivelKey: "maestria", modalidadKeys: ["online"] };
  }
  return null;
}

function planFromHeader(header: string) {
  const normalized = normalizeText(header);
  const cuatrimestres = normalized.match(/([0-9]+)\s*cuatrimestre/);
  if (cuatrimestres) return cuatrimestres[1];
  if (normalized.includes("1 ano 4 meses") || normalized.includes("1 año 4 meses")) {
    return "4";
  }
  const firstNumber = normalized.match(/\b([0-9]{1,2})\b/);
  return firstNumber?.[1] ?? "";
}

function isPriceHeader(header: string) {
  const normalized = normalizeText(header);
  const compacted = compact(header);
  return (
    normalized.includes("precio lista") ||
    ["newprice", "newpricebase", "preciolista", "precio", "monto"].includes(
      compacted,
    )
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function normalizePriceListWorkbookRows(
  workbook: PriceListWorkbook,
): NormalizedPriceListRow[] {
  const output: NormalizedPriceListRow[] = [];

  for (const sheet of workbook.sheets) {
    const defaults = defaultsForSheet(sheet.name);
    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
      const headerRow = sheet.rows[rowIndex] ?? [];
      const headers = headerRow.map((cell) => normalizeHeader(String(cell ?? "")));
      const idxPlantel = findColumn(headers, ["plantel", "campus", "sede"]);
      const idxRegion = findColumn(headers, ["region", "región"]);
      const idxTier = findColumn(headers, ["tier"]);
      const idxNivel = findColumn(headers, ["nivel", "nivelkey", "nivelkey"]);
      const idxModalidad = findColumn(headers, [
        "modalidad",
        "modalidadkey",
        "modalidadkey",
      ]);
      const idxPlan = findColumn(headers, ["plan"]);
      const priceColumns = headerRow
        .map((header, index) => ({ header: String(header ?? ""), index }))
        .filter(({ header }) => isPriceHeader(header));

      if (!priceColumns.length) continue;
      if (!defaults && (idxNivel < 0 || idxModalidad < 0)) continue;

      for (let dataIndex = rowIndex + 1; dataIndex < sheet.rows.length; dataIndex += 1) {
        const row = sheet.rows[dataIndex] ?? [];
        if (!row.some((cell) => String(cell ?? "").trim())) continue;

        const plantel = readCell(row, idxPlantel) || null;
        const region = readCell(row, idxRegion) || null;
        const tier = normalizeTier(readCell(row, idxTier));
        const nivelKey = defaults?.nivelKey ?? normalizeNivel(readCell(row, idxNivel));
        const modalidadKeys = defaults?.modalidadKeys ?? [
          normalizeModalidad(readCell(row, idxModalidad)),
        ];

        for (const priceColumn of priceColumns) {
          const newPrice = parseMoney(row[priceColumn.index]);
          if (newPrice === null) continue;
          const directPlan = readCell(row, idxPlan);
          const plan = directPlan || planFromHeader(priceColumn.header);
          if (!nivelKey || !plan) continue;

          for (const modalidadKey of modalidadKeys) {
            if (!modalidadKey) continue;
            output.push({
              region,
              plantel,
              nivelKey,
              modalidadKey,
              plan: String(plan),
              tier,
              newPrice,
              isActive: true,
              notes: sheet.name,
            });
          }
        }
      }
      break;
    }
  }

  return output;
}

export function priceListRowsToCsv(rows: NormalizedPriceListRow[]) {
  const header = [
    "region",
    "plantel",
    "nivel_key",
    "modalidad_key",
    "plan",
    "tier",
    "new_price",
    "is_active",
    "notes",
  ];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.region ?? "",
        row.plantel ?? "",
        row.nivelKey,
        row.modalidadKey,
        row.plan,
        row.tier ?? "",
        row.newPrice,
        row.isActive ? "true" : "false",
        row.notes ?? "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
}
