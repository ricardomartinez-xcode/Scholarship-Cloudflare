import ExcelJS from "exceljs";

import { EXCEL_SHEETS_OMIT } from "@/config/academicOffer";
import { normalizeKey } from "@/lib/text-normalize";
import { loadExcelWorkbook } from "@/lib/importers/excel-workbook";
import type {
  AcademicOfferPreviewRow,
  ImportAcademicOfferInput,
  PreparedAcademicOfferImportPayload,
} from "@/lib/importers/academic-offer";

type ModulePart = "M1" | "M2" | "M3";
type ModuleValue = ModulePart | "Longitudinal" | "Modular";
type ModuleSelection = ModuleValue;

type ParsedOfferRowLike = {
  programName: string;
  programNormalized: string;
  pricingPlans?: number[] | null;
  module: string;
  moduleCount: number | null;
  subjectsByModule: string | null;
};

type CampusParseResultLike = {
  campusCode: string;
  sheetName: string;
  campusNameFromExcel: string | null;
  rows: ParsedOfferRowLike[];
};

type PreparedAcademicOfferImportLike = {
  summary: {
    warnings: string[];
    detectedSheets?: Record<string, unknown>;
    detectedColumns?: Record<string, unknown> | null;
  };
  previewRows: AcademicOfferPreviewRow[];
  payload: PreparedAcademicOfferImportPayload & {
    detectedSheets?: Record<string, unknown>;
    detectedColumns?: Record<string, unknown> | null;
    parsed?: CampusParseResultLike[];
    warnings?: string[];
  };
};

type HeaderDetection = {
  sheet: ExcelJS.Worksheet;
  headerRowNumber: number;
  score: number;
  columns: {
    campus?: number;
    program?: number;
    module?: number;
    moduleCount?: number;
    subjectsByModule?: number;
    status?: number;
    content: Array<{ column: number; module: ModuleSelection }>;
  };
};

type ModuleConfig = {
  sheetName: string;
  rowNumber: number;
  campusKey: string | null;
  programKey: string;
  planNumbers: number[];
  modules: Set<ModuleSelection>;
  moduleCount: number | null;
  subjectsByModule: string | null;
};

const MODULE_PARTS: ModulePart[] = ["M1", "M2", "M3"];

function cellToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    const cellValue = value as {
      text?: string;
      richText?: Array<{ text?: string }>;
      formula?: string;
      result?: unknown;
      hyperlink?: string;
    };
    if (typeof cellValue.text === "string") return cellValue.text;
    if (Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((part) => part.text ?? "").join("");
    }
    if (cellValue.result != null) return cellToText(cellValue.result);
    if (typeof cellValue.hyperlink === "string") return cellValue.hyperlink;
  }

  return String(value);
}

function cleanText(value: unknown): string {
  return cellToText(value).replace(/\s+/g, " ").trim();
}

function normalized(value: unknown): string {
  return normalizeKey(cleanText(value));
}

function matchKey(value: unknown): string {
  return normalized(value).replace(/[^a-z0-9]/g, "");
}

function parsePlanNumbers(value: unknown): number[] {
  const text = normalized(value)
    .replace(/\bm\s*[1-3]\s*[:=]\s*\d+\b/g, " ")
    .replace(/\bmodulo\s*[1-3]\s*[:=]\s*\d+\b/g, " ")
    .replace(/\bcontenido\s*[1-3]\s*[:=]\s*\d+\b/g, " ")
    .replace(/\bm\s*[1-3]\b/g, " ")
    .replace(/\bmodulo\s*[1-3]\b/g, " ")
    .replace(/\bcontenido\s*[1-3]\b/g, " ");
  if (!text) return [];
  return Array.from(new Set((text.match(/\d+/g) ?? [])
    .map((part) => Number(part))
    .filter((plan) => Number.isInteger(plan) && plan > 0))).sort((left, right) => left - right);
}

function parseModuleCount(value: unknown): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/[1-3]/);
  if (!match) return null;
  const count = Number(match[0]);
  return Number.isInteger(count) && count >= 1 && count <= 3 ? count : null;
}

function parseModulesFromText(value: unknown): Set<ModuleSelection> {
  const text = normalized(value);
  const modules = new Set<ModuleSelection>();
  if (!text) return modules;

  if (text.includes("modular")) modules.add("Modular");
  if (text.includes("longitudinal") || text === "long") modules.add("Longitudinal");

  const checks: Array<[ModulePart, RegExp[]]> = [
    ["M1", [/\bm\s*1\b/, /\bmodulo\s*1\b/, /\bcontenido\s*1\b/, /\b1\b/]],
    ["M2", [/\bm\s*2\b/, /\bmodulo\s*2\b/, /\bcontenido\s*2\b/, /\b2\b/]],
    ["M3", [/\bm\s*3\b/, /\bmodulo\s*3\b/, /\bcontenido\s*3\b/, /\b3\b/]],
  ];

  for (const [module, patterns] of checks) {
    if (patterns.some((pattern) => pattern.test(text))) modules.add(module);
  }

  return modules;
}

function maxModuleCountFromParts(modules: Set<ModuleSelection>) {
  const moduleNumbers = MODULE_PARTS
    .filter((moduleSelection) => modules.has(moduleSelection))
    .map((moduleSelection) => Number(moduleSelection.replace("M", "")));

  return moduleNumbers.length ? Math.max(...moduleNumbers) : null;
}

function moduleFromHeader(header: string): ModuleSelection | null {
  const h = normalizeKey(header);
  if (!h) return null;
  if (h.includes("longitudinal")) return "Longitudinal";

  if (
    h === "m1" ||
    h === "1" ||
    h.includes("contenido 1") ||
    h.includes("contenido1") ||
    h.includes("modulo 1") ||
    h.includes("modulo1")
  ) {
    return "M1";
  }
  if (
    h === "m2" ||
    h === "2" ||
    h.includes("contenido 2") ||
    h.includes("contenido2") ||
    h.includes("modulo 2") ||
    h.includes("modulo2")
  ) {
    return "M2";
  }
  if (
    h === "m3" ||
    h === "3" ||
    h.includes("contenido 3") ||
    h.includes("contenido3") ||
    h.includes("modulo 3") ||
    h.includes("modulo3")
  ) {
    return "M3";
  }

  return null;
}

function looksTruthy(value: unknown): boolean {
  const text = normalized(value);
  if (!text) return false;
  if (["no", "false", "falso", "0", "n/a", "na", "sin", "vacio", "-"].includes(text)) return false;
  return true;
}

function isDescriptiveContent(value: unknown): boolean {
  const text = normalized(value);
  if (!text) return false;
  return !["si", "sí", "x", "ok", "true", "verdadero", "1", "2", "3"].includes(text);
}

function detectColumns(headers: string[]) {
  const columns: HeaderDetection["columns"] = { content: [] };

  headers.forEach((header, index) => {
    const column = index + 1;
    const h = normalizeKey(header);
    if (!h) return;

    const moduleFromContentHeader = moduleFromHeader(header);
    const isModuleCount =
      h.includes("no de modulos") ||
      h.includes("num modulos") ||
      h.includes("numero de modulos") ||
      h.includes("cantidad de modulos") ||
      h === "modulos" ||
      h === "módulos";

    if (moduleFromContentHeader) {
      columns.content.push({ column, module: moduleFromContentHeader });
      return;
    }

    if (!columns.campus && (h.includes("plantel") || h.includes("campus") || h.includes("sede"))) {
      columns.campus = column;
      return;
    }

    if (!columns.program && (h.includes("programa") || h.includes("carrera") || h.includes("licenciatura") || h.includes("posgrado"))) {
      columns.program = column;
      return;
    }

    if (!columns.moduleCount && isModuleCount) {
      columns.moduleCount = column;
      return;
    }

    if (!columns.subjectsByModule && (h.includes("materias por modulo") || h.includes("contenido por modulo") || h.includes("asignaturas por modulo"))) {
      columns.subjectsByModule = column;
      return;
    }

    if (!columns.module && (h === "modulo" || h.includes("modulo inicio") || h.includes("modulo de inicio") || h.includes("track"))) {
      columns.module = column;
      return;
    }

    if (!columns.status && (h === "estado" || h === "status" || h === "activo" || h === "visible")) {
      columns.status = column;
    }
  });

  return columns;
}

function scoreDetection(sheetName: string, columns: HeaderDetection["columns"]) {
  const sheetKey = normalizeKey(sheetName);
  let score = 0;
  if (sheetKey.includes("modulo")) score += 5;
  if (sheetKey.includes("contenido")) score += 3;
  if (columns.program) score += 2;
  if (columns.campus) score += 1;
  if (columns.module) score += 3;
  if (columns.moduleCount) score += 3;
  if (columns.subjectsByModule) score += 2;
  score += Math.min(columns.content.length, 4) * 3;
  return score;
}

function isIgnoredModuleSheet(sheetName: string) {
  const key = normalizeKey(sheetName);
  return (
    key.includes(" vs ") ||
    EXCEL_SHEETS_OMIT.some((ignoredName) => normalizeKey(ignoredName) === key)
  );
}

function detectModuleConfigSheet(workbook: ExcelJS.Workbook): HeaderDetection | null {
  const detections: HeaderDetection[] = [];

  for (const sheet of workbook.worksheets) {
    if (isIgnoredModuleSheet(sheet.name)) continue;
    const maxHeaderRows = Math.min(Math.max(sheet.rowCount, 1), 10);
    for (let rowNumber = 1; rowNumber <= maxHeaderRows; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const maxColumns = Math.max(row.cellCount, sheet.columnCount, 20);
      const headers = Array.from({ length: maxColumns }, (_, index) => cleanText(row.getCell(index + 1).value));
      const columns = detectColumns(headers);
      const score = scoreDetection(sheet.name, columns);
      const sheetKey = normalizeKey(sheet.name);
      const hasDedicatedSheetName =
        sheetKey.includes("modulo") || sheetKey.includes("contenido");
      const hasExplicitModuleColumn = Boolean(
        columns.module || columns.moduleCount || columns.subjectsByModule,
      );
      const hasModuleSignal =
        hasExplicitModuleColumn || (hasDedicatedSheetName && columns.content.length > 0);
      const hasUsefulIdentity = Boolean(columns.program || normalizeKey(sheet.name).includes("modulo"));

      if (score >= 4 && hasModuleSignal && hasUsefulIdentity) {
        detections.push({ sheet, headerRowNumber: rowNumber, score, columns });
      }
    }
  }

  return detections.sort((left, right) => right.score - left.score)[0] ?? null;
}

function rowIsInactive(row: ExcelJS.Row, statusColumn?: number) {
  if (!statusColumn) return false;
  const status = normalized(row.getCell(statusColumn).value);
  return ["no", "false", "falso", "0", "inactivo", "inactiva", "inactive", "baja"].includes(status);
}

function collectSubjectNotes(row: ExcelJS.Row, detection: HeaderDetection): string[] {
  const notes: string[] = [];

  if (detection.columns.subjectsByModule) {
    const text = cleanText(row.getCell(detection.columns.subjectsByModule).value);
    if (text) notes.push(text);
  }

  for (const contentColumn of detection.columns.content) {
    const value = row.getCell(contentColumn.column).value;
    if (looksTruthy(value) && isDescriptiveContent(value)) {
      notes.push(`${contentColumn.module}: ${cleanText(value)}`);
    }
  }

  return notes;
}

function parseModuleConfigs(detection: HeaderDetection): ModuleConfig[] {
  const configs: ModuleConfig[] = [];
  const { sheet, headerRowNumber, columns } = detection;
  let emptyStreak = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const programText = columns.program ? cleanText(row.getCell(columns.program).value) : "";
    const rowText = Array.from({ length: Math.max(row.cellCount, sheet.columnCount, 10) }, (_, index) =>
      cleanText(row.getCell(index + 1).value),
    ).join(" ");

    if (!programText && !rowText.trim()) {
      emptyStreak += 1;
      if (emptyStreak >= 5) break;
      continue;
    }
    emptyStreak = 0;

    if (rowIsInactive(row, columns.status)) continue;
    if (!programText) continue;

    const modules = new Set<ModuleSelection>();
    let moduleCount: number | null = null;

    if (columns.module) {
      const parsedModules = parseModulesFromText(row.getCell(columns.module).value);
      for (const moduleSelection of parsedModules) {
        modules.add(moduleSelection);
      }
      if (parsedModules.has("Modular")) {
        moduleCount =
          maxModuleCountFromParts(parsedModules) ??
          parseModuleCount(row.getCell(columns.module).value);
      }
    }

    if (columns.moduleCount) {
      const count = parseModuleCount(row.getCell(columns.moduleCount).value);
      if (count) {
        moduleCount = count;
        if (!modules.size || modules.has("Modular")) {
          modules.add("Modular");
        }
      }
    }

    if (!modules.has("Modular")) {
      for (const contentColumn of columns.content) {
        if (looksTruthy(row.getCell(contentColumn.column).value)) {
          modules.add(contentColumn.module);
        }
      }
    }

    if (!modules.size) {
      const parsedModules = parseModulesFromText(rowText);
      for (const moduleSelection of parsedModules) {
        modules.add(moduleSelection);
      }
      if (parsedModules.has("Modular")) {
        moduleCount = maxModuleCountFromParts(parsedModules);
      }
    }

    if (!modules.size) continue;
    if (modules.has("Modular")) {
      moduleCount = moduleCount ?? maxModuleCountFromParts(modules);
    }

    const subjectNotes = collectSubjectNotes(row, detection);
    configs.push({
      sheetName: sheet.name,
      rowNumber,
      campusKey: columns.campus ? matchKey(row.getCell(columns.campus).value) || null : null,
      programKey: matchKey(programText),
      planNumbers: parsePlanNumbers(rowText),
      modules,
      moduleCount,
      subjectsByModule: subjectNotes.length ? subjectNotes.join(" | ") : null,
    });
  }

  return configs;
}

function campusMatches(config: ModuleConfig, campus: CampusParseResultLike) {
  if (!config.campusKey) return true;
  const candidates = [campus.campusCode, campus.campusNameFromExcel, campus.sheetName].map(matchKey).filter(Boolean);
  return candidates.some(
    (candidate) =>
      candidate === config.campusKey ||
      (candidate.length >= 4 && config.campusKey?.includes(candidate)) ||
      (config.campusKey != null && config.campusKey.length >= 4 && candidate.includes(config.campusKey)),
  );
}

function programMatches(config: ModuleConfig, row: ParsedOfferRowLike) {
  const candidates = [row.programNormalized, row.programName].map(matchKey).filter(Boolean);
  return candidates.some(
    (candidate) =>
      candidate === config.programKey ||
      (candidate.length >= 5 && config.programKey.includes(candidate)) ||
      (config.programKey.length >= 5 && candidate.includes(config.programKey)),
  );
}

function planMatches(config: ModuleConfig, row: ParsedOfferRowLike) {
  if (!config.planNumbers.length) return true;
  const rowPlans = Array.isArray(row.pricingPlans) ? row.pricingPlans : [];
  if (!rowPlans.length) return true;
  return config.planNumbers.some((plan) => rowPlans.includes(plan));
}

function mergeConfigs(configs: ModuleConfig[]): {
  modules: Set<ModuleSelection>;
  moduleCount: number | null;
  subjectsByModule: string | null;
} {
  const modules = new Set<ModuleSelection>();
  const subjectNotes: string[] = [];
  let moduleCount: number | null = null;

  for (const config of configs) {
    for (const moduleSelection of config.modules) modules.add(moduleSelection);
    if (config.moduleCount != null) {
      moduleCount = Math.max(moduleCount ?? 0, config.moduleCount);
    }
    if (config.subjectsByModule) subjectNotes.push(config.subjectsByModule);
  }

  return {
    modules,
    moduleCount,
    subjectsByModule: subjectNotes.length ? Array.from(new Set(subjectNotes)).join(" | ") : null,
  };
}

function modulesToVariants(
  modules: Set<ModuleSelection>,
  subjectsByModule: string | null,
  moduleCount: number | null,
) {
  const variants: Array<{ module: ModuleValue; moduleCount: number | null; subjectsByModule: string | null }> = [];
  const moduleParts = MODULE_PARTS.filter((moduleSelection) => modules.has(moduleSelection));

  if (modules.has("Modular")) {
    variants.push({ module: "Modular", moduleCount, subjectsByModule });
  } else {
    for (const modulePart of moduleParts) {
      variants.push({ module: modulePart, moduleCount: null, subjectsByModule });
    }
  }

  if (modules.has("Longitudinal")) {
    variants.push({ module: "Longitudinal", moduleCount: null, subjectsByModule });
  }

  return variants;
}

function rowKey(row: ParsedOfferRowLike) {
  return [
    row.programNormalized,
    row.programName,
    row.module,
    row.moduleCount ?? "",
    row.subjectsByModule ?? "",
    (row.pricingPlans ?? []).join(","),
  ].join("|");
}

function applyConfigsToPayload(
  payload: PreparedAcademicOfferImportLike["payload"],
  configs: ModuleConfig[],
) {
  let appliedRows = 0;
  const parsed = Array.isArray(payload.parsed) ? payload.parsed : [];

  for (const campus of parsed) {
    const nextRows: ParsedOfferRowLike[] = [];
    for (const row of campus.rows ?? []) {
      const matchingConfigs = configs.filter(
        (config) => campusMatches(config, campus) && programMatches(config, row) && planMatches(config, row),
      );

      if (!matchingConfigs.length) {
        nextRows.push(row);
        continue;
      }

      const merged = mergeConfigs(matchingConfigs);
      const variants = modulesToVariants(
        merged.modules,
        merged.subjectsByModule,
        merged.moduleCount,
      );
      if (!variants.length) {
        nextRows.push(row);
        continue;
      }

      appliedRows += 1;
      for (const variant of variants) {
        nextRows.push({
          ...row,
          module: variant.module,
          moduleCount: variant.moduleCount,
          subjectsByModule: variant.subjectsByModule ?? row.subjectsByModule ?? null,
        });
      }
    }

    const deduped = new Map<string, ParsedOfferRowLike>();
    for (const row of nextRows) deduped.set(rowKey(row), row);
    campus.rows = Array.from(deduped.values()) as typeof campus.rows;
  }

  return appliedRows;
}

function previewRowKey(row: AcademicOfferPreviewRow) {
  return [
    row.campusCode,
    row.campusName,
    row.programName,
    row.line ?? "",
    row.modality,
    row.module,
    row.moduleCount ?? "",
    row.subjectsByModule ?? "",
    row.pricingPlans.join(","),
    row.isActive ? "active" : "inactive",
  ].join("|");
}

function previewMatchesConfig(config: ModuleConfig, row: AcademicOfferPreviewRow) {
  const programCandidates = [row.programName].map(matchKey).filter(Boolean);
  const campusCandidates = [row.campusCode, row.campusName].map(matchKey).filter(Boolean);
  const programMatch = programCandidates.some(
    (candidate) =>
      candidate === config.programKey ||
      (candidate.length >= 5 && config.programKey.includes(candidate)) ||
      (config.programKey.length >= 5 && candidate.includes(config.programKey)),
  );
  const campusMatch = !config.campusKey || campusCandidates.some(
    (candidate) =>
      candidate === config.campusKey ||
      (candidate.length >= 4 && config.campusKey?.includes(candidate)) ||
      (config.campusKey != null && config.campusKey.length >= 4 && candidate.includes(config.campusKey)),
  );
  return programMatch && campusMatch;
}

function applyConfigsToPreview(previewRows: AcademicOfferPreviewRow[], configs: ModuleConfig[]) {
  const nextRows: AcademicOfferPreviewRow[] = [];

  for (const row of previewRows) {
    const matchingConfigs = configs.filter((config) => previewMatchesConfig(config, row));
    if (!matchingConfigs.length) {
      nextRows.push(row);
      continue;
    }

    const merged = mergeConfigs(matchingConfigs);
    const variants = modulesToVariants(
      merged.modules,
      merged.subjectsByModule,
      merged.moduleCount,
    );
    if (!variants.length) {
      nextRows.push(row);
      continue;
    }

    for (const variant of variants) {
      nextRows.push({
        ...row,
        id: `${row.id}:${variant.module}:${variant.moduleCount ?? ""}`,
        module: variant.module,
        moduleCount: variant.moduleCount,
        subjectsByModule: variant.subjectsByModule ?? row.subjectsByModule ?? null,
      });
    }
  }

  const deduped = new Map<string, AcademicOfferPreviewRow>();
  for (const row of nextRows) deduped.set(previewRowKey(row), row);
  previewRows.splice(0, previewRows.length, ...deduped.values());
}

function pushUniqueWarning(target: string[] | undefined, message: string) {
  if (!target) return;
  if (!target.includes(message)) target.push(message);
}

export async function enrichAcademicOfferImportWithModuleSheet<TPrepared extends PreparedAcademicOfferImportLike>(params: {
  input: ImportAcademicOfferInput;
  prepared: TPrepared;
}): Promise<TPrepared> {
  const workbook = await loadExcelWorkbook(params.input);
  const detection = detectModuleConfigSheet(workbook);

  if (!detection) return params.prepared;

  const configs = parseModuleConfigs(detection);
  if (!configs.length) {
    const warning = `Se detectó la tabla "${detection.sheet.name}" para módulos, pero no produjo configuraciones válidas. Revisa columnas como Programa, Plantel, Modulo, Contenido 1, Contenido 2, Contenido 3 o Longitudinal.`;
    pushUniqueWarning(params.prepared.summary.warnings, warning);
    pushUniqueWarning(params.prepared.payload.warnings, warning);
    return params.prepared;
  }

  const appliedRows = applyConfigsToPayload(params.prepared.payload, configs);
  applyConfigsToPreview(params.prepared.previewRows, configs);

  params.prepared.summary.detectedSheets = {
    ...(params.prepared.summary.detectedSheets ?? {}),
    modules: detection.sheet.name,
  };
  params.prepared.payload.detectedSheets = {
    ...(params.prepared.payload.detectedSheets ?? {}),
    modules: detection.sheet.name,
  };
  params.prepared.summary.detectedColumns = {
    ...(params.prepared.summary.detectedColumns ?? {}),
    modules: detection.columns,
  };
  params.prepared.payload.detectedColumns = {
    ...(params.prepared.payload.detectedColumns ?? {}),
    modules: detection.columns,
  } as typeof params.prepared.payload.detectedColumns;

  const warning = `Configuración de módulos detectada en "${detection.sheet.name}": ${configs.length} filas leídas, ${appliedRows} ofertas enriquecidas respetando módulos explícitos como M1, M2, Modular o Longitudinal.`;
  pushUniqueWarning(params.prepared.summary.warnings, warning);
  pushUniqueWarning(params.prepared.payload.warnings, warning);

  return params.prepared;
}
