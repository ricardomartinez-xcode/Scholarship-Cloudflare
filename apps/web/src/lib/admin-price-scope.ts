import { normalizeKey } from "@/lib/text-normalize";

export type AdminPriceScopePreset =
  | "general"
  | "tier"
  | "campus"
  | "campus_tier"
  | "program"
  | "program_tier"
  | "program_campus"
  | "program_campus_tier";

export type AdminPriceScopeField = "programa" | "plantel" | "tier";

export type AdminPriceScopeTarget = {
  programa_key?: unknown;
  programaKey?: unknown;
  program_key?: unknown;
  programKey?: unknown;
  programa?: unknown;
  program?: unknown;
  plantel?: unknown;
  campus?: unknown;
  sede?: unknown;
  tier?: unknown;
};

export type AdminPriceScopeDefinition = {
  value: AdminPriceScopePreset;
  label: string;
  shortLabel: string;
  description: string;
  fields: AdminPriceScopeField[];
};

export const PRICE_SCOPE_PRESETS: AdminPriceScopeDefinition[] = [
  {
    value: "general",
    label: "General por línea, modalidad y plan",
    shortLabel: "General",
    description: "Aplica a todos los programas, planteles y tiers de esa línea/modalidad/plan.",
    fields: [],
  },
  {
    value: "tier",
    label: "Por tier",
    shortLabel: "Tier",
    description: "Aplica a todos los planteles del tier seleccionado.",
    fields: ["tier"],
  },
  {
    value: "campus",
    label: "Por plantel",
    shortLabel: "Plantel",
    description: "Aplica solo al plantel seleccionado, sin depender del tier.",
    fields: ["plantel"],
  },
  {
    value: "campus_tier",
    label: "Por plantel + tier",
    shortLabel: "Plantel + tier",
    description: "Aplica al plantel seleccionado y documenta su tier de referencia.",
    fields: ["plantel", "tier"],
  },
  {
    value: "program",
    label: "Por programa",
    shortLabel: "Programa",
    description: "Aplica solo al programa/carrera seleccionado en todos los planteles.",
    fields: ["programa"],
  },
  {
    value: "program_tier",
    label: "Por programa + tier",
    shortLabel: "Programa + tier",
    description: "Aplica solo al programa/carrera y tier seleccionados.",
    fields: ["programa", "tier"],
  },
  {
    value: "program_campus",
    label: "Por programa + plantel",
    shortLabel: "Programa + plantel",
    description: "Aplica solo al programa/carrera y plantel seleccionados.",
    fields: ["programa", "plantel"],
  },
  {
    value: "program_campus_tier",
    label: "Por programa + plantel + tier",
    shortLabel: "Programa + plantel + tier",
    description: "Aplica solo al programa/carrera y plantel seleccionados, documentando el tier.",
    fields: ["programa", "plantel", "tier"],
  },
];

const PRESETS_BY_VALUE = new Map(PRICE_SCOPE_PRESETS.map((preset) => [preset.value, preset]));

const SCOPE_ALIASES: Record<string, AdminPriceScopePreset> = {
  general: "general",
  linea: "general",
  "línea": "general",
  "linea modalidad plan": "general",
  tier: "tier",
  "por tier": "tier",
  plantel: "campus",
  campus: "campus",
  sede: "campus",
  "por plantel": "campus",
  "plantel tier": "campus_tier",
  "campus tier": "campus_tier",
  "plantel + tier": "campus_tier",
  programa: "program",
  carrera: "program",
  program: "program",
  "por programa": "program",
  "programa tier": "program_tier",
  "programa + tier": "program_tier",
  "program tier": "program_tier",
  "programa plantel": "program_campus",
  "programa + plantel": "program_campus",
  "programa campus": "program_campus",
  "program campus": "program_campus",
  "programa plantel tier": "program_campus_tier",
  "programa + plantel + tier": "program_campus_tier",
  "programa campus tier": "program_campus_tier",
};

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function normalizeScopeAlias(value: unknown) {
  return normalizeKey(String(value ?? "").replace(/[+_/\-]+/g, " ")).replace(/\s+/g, " ").trim();
}

export function normalizeAdminPriceScopePreset(
  value: unknown,
): AdminPriceScopePreset | null {
  const normalized = normalizeScopeAlias(value);
  if (!normalized) return null;
  return SCOPE_ALIASES[normalized] ?? null;
}

export function adminPriceScopeDefinition(
  preset: AdminPriceScopePreset,
): AdminPriceScopeDefinition {
  return PRESETS_BY_VALUE.get(preset) ?? PRICE_SCOPE_PRESETS[0]!;
}

export function adminPriceScopeFields(preset: AdminPriceScopePreset): AdminPriceScopeField[] {
  return adminPriceScopeDefinition(preset).fields;
}

export function adminPriceScopeRequiresField(
  preset: AdminPriceScopePreset,
  field: AdminPriceScopeField,
) {
  return adminPriceScopeFields(preset).includes(field);
}

export function inferAdminPriceScopePreset(
  target: AdminPriceScopeTarget,
): AdminPriceScopePreset {
  const hasProgram = hasText(
    target.programa_key ??
      target.programaKey ??
      target.program_key ??
      target.programKey ??
      target.programa ??
      target.program,
  );
  const hasCampus = hasText(target.plantel ?? target.campus ?? target.sede);
  const hasTier = hasText(target.tier);

  if (hasProgram && hasCampus && hasTier) return "program_campus_tier";
  if (hasProgram && hasCampus) return "program_campus";
  if (hasProgram && hasTier) return "program_tier";
  if (hasProgram) return "program";
  if (hasCampus && hasTier) return "campus_tier";
  if (hasCampus) return "campus";
  if (hasTier) return "tier";
  return "general";
}

export function formatAdminPriceScopePreset(preset: AdminPriceScopePreset) {
  return adminPriceScopeDefinition(preset).shortLabel;
}

export function describeAdminPriceScopePreset(preset: AdminPriceScopePreset) {
  return adminPriceScopeDefinition(preset).description;
}

export function formatAdminPriceScopeTarget(target: AdminPriceScopeTarget) {
  return formatAdminPriceScopePreset(inferAdminPriceScopePreset(target));
}

export function adminPriceScopeSpecificityScore(target: AdminPriceScopeTarget) {
  switch (inferAdminPriceScopePreset(target)) {
    case "program_campus_tier":
      return 800;
    case "program_campus":
      return 760;
    case "program_tier":
      return 720;
    case "program":
      return 680;
    case "campus_tier":
      return 500;
    case "campus":
      return 460;
    case "tier":
      return 300;
    case "general":
    default:
      return 100;
  }
}
