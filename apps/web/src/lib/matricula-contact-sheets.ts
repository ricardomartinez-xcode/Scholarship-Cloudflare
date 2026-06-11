export const MATRICULA_CONTACT_HEADERS = [
  "contact_key",
  "nombre",
  "telefono_normalizado",
  "telefono_original",
  "correo",
  "expediente",
  "linea",
  "programa",
  "plantel",
  "estado_contactabilidad",
  "ultima_clasificacion",
  "ultimo_motivo",
  "ultima_resolucion",
  "toques",
  "ultima_fuente",
  "notas",
] as const;

export const MATRICULA_CONTACT_AUDIT_HEADERS = [
  "accion",
  "registrado_en",
  "matricula",
  "expediente",
  "nombre_completo",
  "correo",
  "telefono",
  "plantel",
  "region",
  "modalidad",
  "programa",
  "modulo",
  "ciclo",
  "tipo_ingreso",
  "beca_pct",
  "fuente",
] as const;

export type MatriculaContactSheetInput = {
  matricula: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  campus?: string | null;
  campusCode?: string | null;
  region?: string | null;
  modality?: string | null;
  program?: string | null;
  programCode?: string | null;
  module?: string | null;
  cycle?: string | null;
  businessLine?: string | null;
  enrollmentType?: string | null;
  scholarshipPercent?: number | null;
  submittedAt?: string | null;
};

export type MatriculaContactMatchKey = "matricula" | "fullName" | "email" | "phone";

export type MatriculaContactRowMatch = {
  rowIndex: number;
  matchedBy: MatriculaContactMatchKey;
};

type HeaderMap = Map<string, number>;

function compact(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string | number | null | undefined) {
  return compact(value).toLowerCase();
}

function normalizePhone(value: string | number | null | undefined) {
  return compact(value).replace(/\D+/g, "");
}

function normalizeEmail(value: string | number | null | undefined) {
  return normalizeText(value);
}

function normalizeHeader(value: string | number | null | undefined) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildHeaderMap(headerRow: unknown[]): HeaderMap {
  const map = new Map<string, number>();
  headerRow.forEach((value, index) => {
    const key = normalizeHeader(String(value ?? ""));
    if (key) map.set(key, index);
  });
  return map;
}

function readCell(row: unknown[], headerMap: HeaderMap, keys: string[]) {
  for (const key of keys) {
    const index = headerMap.get(key);
    if (index === undefined) continue;
    const value = compact(row[index] as string | number | null | undefined);
    if (value) return value;
  }
  return "";
}

function hasSameMatricula(row: unknown[], headerMap: HeaderMap, input: MatriculaContactSheetInput) {
  const expected = normalizeText(input.matricula || input.externalId);
  if (!expected) return false;
  const actual = normalizeText(
    readCell(row, headerMap, ["expediente", "matricula", "student_external_id"]),
  );
  return Boolean(actual && actual === expected);
}

function hasSameFullName(row: unknown[], headerMap: HeaderMap, input: MatriculaContactSheetInput) {
  const expected = normalizeText(input.fullName);
  if (!expected) return false;
  const actual = normalizeText(
    readCell(row, headerMap, ["nombre", "nombre_completo", "contact_name"]),
  );
  return Boolean(actual && actual === expected);
}

function hasSameEmail(row: unknown[], headerMap: HeaderMap, input: MatriculaContactSheetInput) {
  const expected = normalizeEmail(input.email);
  if (!expected) return false;
  const actual = normalizeEmail(readCell(row, headerMap, ["correo", "email"]));
  return Boolean(actual && actual === expected);
}

function hasSamePhone(row: unknown[], headerMap: HeaderMap, input: MatriculaContactSheetInput) {
  const expected = normalizePhone(input.phone);
  if (!expected) return false;
  const actual = normalizePhone(
    readCell(row, headerMap, ["telefono_normalizado", "telefono_original", "telefono", "phone"]),
  );
  return Boolean(actual && actual === expected);
}

export function findMatriculaContactRowIndex(
  values: unknown[][],
  input: MatriculaContactSheetInput,
): MatriculaContactRowMatch | null {
  const header = values[0] ?? [];
  const headerMap = buildHeaderMap(header);

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] ?? [];
    if (hasSameMatricula(row, headerMap, input)) {
      return { rowIndex: index + 1, matchedBy: "matricula" };
    }
    if (hasSameFullName(row, headerMap, input)) {
      return { rowIndex: index + 1, matchedBy: "fullName" };
    }
    if (hasSameEmail(row, headerMap, input)) {
      return { rowIndex: index + 1, matchedBy: "email" };
    }
    if (hasSamePhone(row, headerMap, input)) {
      return { rowIndex: index + 1, matchedBy: "phone" };
    }
  }

  return null;
}

function contactKey(input: MatriculaContactSheetInput) {
  return normalizePhone(input.phone) || normalizeEmail(input.email) || compact(input.matricula);
}

function notes(input: MatriculaContactSheetInput) {
  return [
    input.matricula ? `matricula=${compact(input.matricula)}` : null,
    input.region ? `region=${compact(input.region)}` : null,
    input.modality ? `modalidad=${compact(input.modality)}` : null,
    input.module ? `modulo=${compact(input.module)}` : null,
    input.cycle ? `ciclo=${compact(input.cycle)}` : null,
    input.enrollmentType ? `tipo_ingreso=${compact(input.enrollmentType)}` : null,
    typeof input.scholarshipPercent === "number"
      ? `beca=${input.scholarshipPercent}%`
      : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("; ");
}

export function buildMatriculaContactRow(input: MatriculaContactSheetInput) {
  const normalizedPhone = normalizePhone(input.phone);
  return [
    contactKey(input),
    compact(input.fullName),
    normalizedPhone,
    compact(input.phone),
    compact(input.email),
    compact(input.matricula || input.externalId),
    compact(input.businessLine),
    compact(input.program),
    compact(input.campus),
    "Inscrito",
    "",
    "",
    "INSCRITO",
    0,
    "Matricula ReCalc",
    notes(input),
  ];
}

export function buildMatriculaContactAuditRow(
  action: "created" | "updated",
  input: MatriculaContactSheetInput,
) {
  return [
    action,
    compact(input.submittedAt) || new Date().toISOString(),
    compact(input.matricula),
    compact(input.matricula || input.externalId),
    compact(input.fullName),
    compact(input.email),
    compact(input.phone),
    compact(input.campus),
    compact(input.region),
    compact(input.modality),
    compact(input.program),
    compact(input.module),
    compact(input.cycle),
    compact(input.enrollmentType),
    typeof input.scholarshipPercent === "number" ? input.scholarshipPercent : "",
    "Matricula ReCalc",
  ];
}
