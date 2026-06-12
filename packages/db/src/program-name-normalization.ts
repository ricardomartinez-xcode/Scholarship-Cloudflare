const HIGH_CONFIDENCE_PROGRAM_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: "Administracion de Empresas",
    aliases: [
      "Licenciatura Administracion de Empresas",
      "Licenciatura en Administracion de Empresas",
    ],
  },
  {
    canonical: "Ingenieria en Sistemas Computacionales",
    aliases: [
      "Sistemas Computacionales",
      "Ingenieria Sistemas Computacionales",
      "Ingenieria en Sistemas Computacionales",
      "Ingeneriia en Sistemas Computacionales",
    ],
  },
  {
    canonical: "Ingenieria Industrial y de Sistemas",
    aliases: [
      "Industrial y de Sistemas",
      "Industrial y Sistemas",
      "Ingenieria Industrial y de Sistemas",
      "Licenciatura en Ingenieria Industrial y de Sistemas",
      "Licenciatiura en Ingenieria Industrial y de Sistemas",
    ],
  },
  {
    canonical: "Administracion de Empresas Turisticas",
    aliases: [
      "Adm. de Empresas Tur.",
      "Administracion de Empresas Turisticas",
      "Empresas Turisticas",
    ],
  },
  {
    canonical: "Ingenieria en Manufactura y Robotica",
    aliases: [
      "Ingenieria en Manufactura y Robotica",
      "Manufactura y Robotica",
    ],
  },
  {
    canonical: "Contaduria Publica",
    aliases: [
      "Contaduria",
      "Contaduria Publica",
    ],
  },
  {
    canonical: "Administracion de Negocios y Mercadotecnia",
    aliases: [
      "Administracion de Negocios y Mecadotecnia",
      "Administracion de Negocios y Mercadotecnia",
    ],
  },
  {
    canonical: "Licenciatura en Derecho",
    aliases: [
      "Derecho",
      "Lic. Derecho",
      "Lic. en Derecho",
      "Licenciatura Derecho",
      "Licenciatura en Derecho",
    ],
  },
  {
    canonical: "Licenciatura en Enfermería",
    aliases: [
      "Enfermeria",
      "Lic. Enfermeria",
      "Lic. en Enfermeria",
      "Licenciatura Enfermeria",
      "Licenciatura en Enfermeria",
    ],
  },
  {
    canonical: "Licenciatura en Fisioterapia",
    aliases: [
      "Fisioterapia",
      "Lic. Fisioterapia",
      "Lic. en Fisioterapia",
      "Licenciatura Fisioterapia",
      "Licenciatura en Fisioterapia",
    ],
  },
  {
    canonical: "Licenciatura en Nutrición",
    aliases: [
      "Nutricion",
      "Lic. Nutricion",
      "Lic. en Nutricion",
      "Licenciatura Nutricion",
      "Licenciatura en Nutricion",
    ],
  },
  {
    canonical: "Licenciatura en Pedagogía",
    aliases: [
      "Pedagogia",
      "Lic. Pedagogia",
      "Lic. en Pedagogia",
      "Licenciatura Pedagogia",
      "Licenciatura en Pedagogia",
    ],
  },
  {
    canonical: "Licenciatura en Psicología",
    aliases: [
      "Psicologia",
      "Lic. Psicologia",
      "Lic. en Psicologia",
      "Licenciatura Psicologia",
      "Licenciatura en Psicologia",
    ],
  },
];

const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\blicenciatiura\b/g, "licenciatura"],
  [/\bingeneriia\b/g, "ingenieria"],
  [/\bmecadotecnia\b/g, "mercadotecnia"],
  [/\badm\b/g, "administracion"],
  [/\btur\b/g, "turisticas"],
];

function baseProgramKey(input: string | null | undefined): string {
  let value = String(input ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/&/g, " y ")
    .replace(/[()]/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  return value
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanProgramDisplayName(input: string | null | undefined): string {
  let value = String(input ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  value = value
    .replace(/\bLicenciatiura\b/gi, "Licenciatura")
    .replace(/\bIngeneriia\b/gi, "Ingenieria")
    .replace(/\bMecadotecnia\b/gi, "Mercadotecnia")
    .replace(/\bAdm\./gi, "Administracion")
    .replace(/\bTur\./gi, "Turisticas");

  return value.replace(/\s+/g, " ").trim();
}

const canonicalByKey = new Map<string, string>();

for (const group of HIGH_CONFIDENCE_PROGRAM_ALIASES) {
  canonicalByKey.set(baseProgramKey(group.canonical), group.canonical);
  for (const alias of group.aliases) {
    canonicalByKey.set(baseProgramKey(alias), group.canonical);
  }
}

export type NormalizedAcademicProgramName = {
  name: string;
  nameNormalized: string;
  sourceNormalized: string;
  wasNormalized: boolean;
};

export function normalizeAcademicProgramKey(input: string | null | undefined): string {
  const sourceNormalized = baseProgramKey(input);
  const canonical = canonicalByKey.get(sourceNormalized);
  return canonical ? baseProgramKey(canonical) : sourceNormalized;
}

export function normalizeAcademicProgramName(input: string | null | undefined): NormalizedAcademicProgramName {
  const cleanedName = cleanProgramDisplayName(input);
  const sourceNormalized = baseProgramKey(cleanedName);
  const canonicalName = canonicalByKey.get(sourceNormalized) ?? cleanedName;
  const nameNormalized = baseProgramKey(canonicalName);

  return {
    name: canonicalName,
    nameNormalized,
    sourceNormalized,
    wasNormalized: sourceNormalized !== nameNormalized || cleanedName !== canonicalName,
  };
}
