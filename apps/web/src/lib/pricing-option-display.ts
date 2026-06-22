import {
  setVisibleAcademicModuleChoicesForQuote,
  type AcademicModule,
} from "@/lib/academic-modules";
import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
  type CanonicalBusinessLine,
  type CanonicalModalityValue,
} from "@/lib/pricing-normalize";

export type QuoteCampusOption = {
  value: string;
  label: string;
  businessLines?: string[];
  modalities?: string[];
  studyPrograms?: Array<{
    id: string;
    name: string;
    businessLine: string;
  }>;
  pricingOptions?: Array<{
    businessLine: string;
    modality: string;
    plan: number;
    module: AcademicModule;
    programId?: string;
  }>;
};

export type QuoteStudyProgramOption = NonNullable<QuoteCampusOption["studyPrograms"]>[number];

export const ONLINE_QUOTE_CAMPUS = { value: "ONLINE", label: "Online" } as const;

const MODALITY_ORDER: Record<CanonicalModalityValue, number> = {
  presencial: 0,
  mixta: 1,
  online: 2,
};

const MODULE_ORDER: Record<AcademicModule, number> = {
  M1: 0,
  M2: 1,
  M3: 2,
  Longitudinal: 3,
  Modular: 9,
};

const VISIBLE_MODALITIES_BY_BUSINESS_LINE: Record<
  CanonicalBusinessLine,
  CanonicalModalityValue[]
> = {
  licenciatura: ["presencial", "mixta", "online"],
  prepa: ["presencial", "online"],
  salud: ["presencial"],
  posgrado: ["online"],
};

function sortModalities<T extends string>(modalities: T[]) {
  return [...modalities].sort(
    (left, right) =>
      (MODALITY_ORDER[left as CanonicalModalityValue] ?? 9) -
      (MODALITY_ORDER[right as CanonicalModalityValue] ?? 9),
  );
}

function sortModules<T extends AcademicModule>(modules: T[]) {
  return [...modules].sort(
    (left, right) => (MODULE_ORDER[left] ?? 9) - (MODULE_ORDER[right] ?? 9),
  );
}

function uniqSorted(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "es"),
  );
}

function campusOffersBusinessLine(campus: QuoteCampusOption, businessLine: string) {
  return !campus.businessLines?.length || campus.businessLines.includes(businessLine);
}

function campusOffersModality(campus: QuoteCampusOption, modality: string) {
  return !campus.modalities?.length || campus.modalities.includes(modality);
}

function pricingOptionMatches(
  option: NonNullable<QuoteCampusOption["pricingOptions"]>[number],
  params: {
    businessLine?: string;
    modality?: string;
    plan?: number | null;
    programId?: string | null;
  },
) {
  const normalizedBusinessLine = normalizeBusinessLine(params.businessLine) ?? params.businessLine;
  const normalizedModality = normalizeCanonicalModality(params.modality) ?? params.modality;

  return (
    (!normalizedBusinessLine || option.businessLine === normalizedBusinessLine) &&
    (!normalizedModality || option.modality === normalizedModality) &&
    (!params.plan || option.plan === params.plan) &&
    (!params.programId || option.programId === params.programId)
  );
}

function collectQuoteModules(
  campuses: QuoteCampusOption[],
  params: {
    businessLine?: string;
    modality?: string;
    plan?: number | null;
    programId?: string | null;
  },
): AcademicModule[] {
  const modules = campuses.flatMap((campus) =>
    (campus.pricingOptions ?? [])
      .filter((option) => pricingOptionMatches(option, params))
      .map((option) => option.module),
  );

  return sortModules(Array.from(new Set(modules.filter(Boolean))));
}

function publishQuoteModules(
  campuses: QuoteCampusOption[],
  params: {
    businessLine?: string;
    modality?: string;
    plan?: number | null;
    programId?: string | null;
  },
) {
  setVisibleAcademicModuleChoicesForQuote(collectQuoteModules(campuses, params));
}

export function visibleQuoteModalities(
  modalities: string[],
  businessLine?: string,
): CanonicalModalityValue[] {
  const available = modalities
    .map((modality) => normalizeCanonicalModality(modality))
    .filter((modality): modality is CanonicalModalityValue => Boolean(modality));

  const normalizedBusinessLine = normalizeBusinessLine(businessLine);

  if (normalizedBusinessLine) {
    const availableSet = new Set(available);
    return VISIBLE_MODALITIES_BY_BUSINESS_LINE[normalizedBusinessLine].filter((modality) =>
      availableSet.has(modality),
    );
  }

  return sortModalities(Array.from(new Set(available)));
}

export function visibleQuoteBusinessLines(
  campuses: QuoteCampusOption[],
  fallbackOptions: Array<{ businessLine: string }> = [],
): CanonicalBusinessLine[] {
  const offered = campuses.flatMap((campus) => campus.businessLines ?? []);
  const source = offered.length ? offered : fallbackOptions.map((option) => option.businessLine);
  return uniqSorted(
    source
      .map((businessLine) => normalizeBusinessLine(businessLine))
      .filter((businessLine): businessLine is CanonicalBusinessLine => Boolean(businessLine)),
  ) as CanonicalBusinessLine[];
}

export function visibleQuoteStudyPrograms(
  campuses: QuoteCampusOption[],
  fallbackPrograms: QuoteStudyProgramOption[],
  businessLine?: string,
  modality?: string,
): QuoteStudyProgramOption[] {
  const normalizedBusinessLine = normalizeBusinessLine(businessLine);
  const normalizedModality = normalizeCanonicalModality(modality);
  if (!normalizedBusinessLine || !normalizedModality) return [];

  const programsById = new Map<string, QuoteStudyProgramOption>();
  for (const campus of campuses) {
    if (!campusOffersBusinessLine(campus, normalizedBusinessLine)) continue;
    if (!campusOffersModality(campus, normalizedModality)) continue;
    for (const program of campus.studyPrograms ?? []) {
      if (normalizeBusinessLine(program.businessLine) === normalizedBusinessLine) {
        programsById.set(program.id, program);
      }
    }
  }

  if (!programsById.size) {
    for (const program of fallbackPrograms) {
      if (normalizeBusinessLine(program.businessLine) === normalizedBusinessLine) {
        programsById.set(program.id, program);
      }
    }
  }

  return Array.from(programsById.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );
}

export function visibleQuoteCampuses(
  campuses: QuoteCampusOption[],
  modality?: string,
  businessLine?: string,
  plan?: number | null,
  programId?: string | null,
): QuoteCampusOption[] {
  const normalizedBusinessLine = normalizeBusinessLine(businessLine);
  const normalizedModality = normalizeCanonicalModality(modality);
  const selectedBusinessLine = normalizedBusinessLine ?? businessLine;
  const selectedModality = normalizedModality ?? modality;
  const moduleParams = {
    businessLine: selectedBusinessLine,
    modality: selectedModality,
    plan,
    programId,
  };

  if (selectedModality === "online") {
    const sourceOnlineCampus: QuoteCampusOption =
      campuses.find((campus) => campus.value.toUpperCase() === ONLINE_QUOTE_CAMPUS.value) ??
      ONLINE_QUOTE_CAMPUS;
    const onlineCampus: QuoteCampusOption = {
      ...sourceOnlineCampus,
      value: ONLINE_QUOTE_CAMPUS.value,
      label: sourceOnlineCampus.label || ONLINE_QUOTE_CAMPUS.label,
    };

    const offersSelectedProgram =
      !programId ||
      !sourceOnlineCampus.studyPrograms?.length ||
      sourceOnlineCampus.studyPrograms.some((program) => program.id === programId);

    if (!offersSelectedProgram) {
      publishQuoteModules([], moduleParams);
      return [];
    }

    if (!selectedBusinessLine || !selectedModality || !plan) {
      publishQuoteModules([sourceOnlineCampus], moduleParams);
      return [onlineCampus];
    }

    if (!sourceOnlineCampus.pricingOptions?.length) {
      publishQuoteModules([], moduleParams);
      return [];
    }

    const hasPricingOption = sourceOnlineCampus.pricingOptions.some((option) =>
      pricingOptionMatches(option, moduleParams),
    );
    publishQuoteModules(hasPricingOption ? [sourceOnlineCampus] : [], moduleParams);

    return hasPricingOption ? [onlineCampus] : [];
  }

  const filteredCampuses = campuses
    .filter((campus) => campus.value && campus.value.toUpperCase() !== ONLINE_QUOTE_CAMPUS.value)
    .filter((campus) => {
      if (!selectedBusinessLine || !campus.businessLines?.length) return true;
      return campus.businessLines.includes(selectedBusinessLine);
    })
    .filter((campus) => {
      if (!selectedModality || !campus.modalities?.length) return true;
      return campus.modalities.includes(selectedModality);
    })
    .filter((campus) => {
      if (!programId || !campus.studyPrograms?.length) return true;
      return campus.studyPrograms.some((program) => program.id === programId);
    })
    .filter((campus) => {
      if (!selectedBusinessLine || !selectedModality || !plan) return true;
      if (!campus.pricingOptions?.length) return false;
      return campus.pricingOptions.some((option) => pricingOptionMatches(option, moduleParams));
    })
    .sort((left, right) => left.label.localeCompare(right.label, "es"));

  publishQuoteModules(filteredCampuses, moduleParams);
  return filteredCampuses;
}

export function visibleQuoteModules(
  campus: QuoteCampusOption | null | undefined,
  params: {
    businessLine?: string;
    modality?: string;
    plan?: number | null;
    programId?: string | null;
  },
): AcademicModule[] {
  const modules = campus ? collectQuoteModules([campus], params) : [];
  setVisibleAcademicModuleChoicesForQuote(modules);
  return modules;
}
