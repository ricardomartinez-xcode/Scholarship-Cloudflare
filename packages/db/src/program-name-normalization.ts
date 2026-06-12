const HIGH_CONFIDENCE_PROGRAM_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: "Licenciatura en Administración de Empresas",
    aliases: [
      "Administracion de Empresas",
      "Licenciatura Administracion de Empresas",
      "Licenciatura en Administracion de Empresas",
    ],
  },
  {
    canonical: "Licenciatura en Ingeniería en Sistemas Computacionales",
    aliases: [
      "Sistemas Computacionales",
      "Ingenieria Sistemas Computacionales",
      "Ingenieria en Sistemas Computacionales",
      "Ingeniería en Sistemas Computacionales",
      "Ingeneriia en Sistemas Computacionales",
    ],
  },
  {
    canonical: "Licenciatura en Ingeniería Industrial y de Sistemas",
    aliases: [
      "Industrial y de Sistemas",
      "Industrial y Sistemas",
      "Ingenieria Industrial y de Sistemas",
      "Ingeniería Industrial y de Sistemas",
      "Licenciatura en Ingenieria Industrial y de Sistemas",
      "Licenciatiura en Ingenieria Industrial y de Sistemas",
    ],
  },
  {
    canonical: "Licenciatura en Administración de Empresas Turísticas",
    aliases: [
      "Adm. de Empresas Tur.",
      "Administracion de Empresas Turisticas",
      "Administración de Empresas Turísticas",
      "Empresas Turisticas",
    ],
  },
  {
    canonical: "Licenciatura en Ingeniería en Manufactura y Robótica",
    aliases: [
      "Ingenieria en Manufactura y Robotica",
      "Ingeniería en Manufactura y Robótica",
      "Manufactura y Robotica",
    ],
  },
  {
    canonical: "Licenciatura en Contaduría Pública",
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
    canonical: "Licenciatura en Administración de Recursos Humanos",
    aliases: ["Administracion de Recursos Humanos"],
  },
  {
    canonical: "Licenciatura en Administración de Tecnologías de la Información",
    aliases: ["Administracion de Tecnologias de la Informacion"],
  },
  {
    canonical: "Licenciatura en Arquitectura",
    aliases: ["Arquitectura"],
  },
  {
    canonical: "Licenciatura en Ciencias de la Comunicación",
    aliases: ["Ciencias de la Comunicacion"],
  },
  {
    canonical: "Licenciatura en Comercio Internacional",
    aliases: ["Comercio Internacional"],
  },
  {
    canonical: "Licenciatura en Criminología",
    aliases: ["Criminologia"],
  },
  {
    canonical: "Licenciatura en Diseño Gráfico",
    aliases: ["Diseno Grafico"],
  },
  {
    canonical: "Licenciatura en Economía y Finanzas",
    aliases: ["Economia y Finanzas"],
  },
  {
    canonical: "Licenciatura en Ingeniería en Logística",
    aliases: ["Ingenieria en Logistica", "Ingeniería en Logística"],
  },
  {
    canonical: "Licenciatura en Ingeniería en Software y Redes",
    aliases: ["Ingenieria en Software y Redes", "Ingeniería en Software y Redes"],
  },
  {
    canonical: "Licenciatura en Ingeniería Industrial y Administración",
    aliases: ["Ingenieria Industrial y Administracion", "Ingeniería Industrial y Administración"],
  },
  {
    canonical: "Licenciatura en Mercadotecnia",
    aliases: ["Mercadotecnia"],
  },
  {
    canonical: "Licenciatura en Negocios Internacionales",
    aliases: ["Negocios Internacionales"],
  },
  {
    canonical: "Licenciatura en Relaciones Internacionales",
    aliases: ["Relaciones Internacionales"],
  },
  {
    canonical: "Licenciatura en Seguridad Pública",
    aliases: ["Seguridad Publica", "Seguridad Pública"],
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
  {
    canonical: "Maestría en Administración de Negocios y Mercadotecnia",
    aliases: [
      "Maestria en Administracion de Negocios y Mecadotecnia",
      "Maestría en Administración de Negocios y Mecadotecnia",
      "Maestria en Administracion de Negocios y Mercadotecnia",
      "Maestría en Administración de Negocios y Mercadotecnia",
    ],
  },
  {
    canonical: "Maestría en Administración Financiera",
    aliases: [
      "Administracion Financiera",
      "Maestria Administracion Financiera",
      "Maestria en Administracion Financiera",
      "Maestría en Administración Financiera",
    ],
  },
  {
    canonical: "Maestría en Logística y Cadena de Suministro",
    aliases: [
      "Logistica y Cadena de Suministro",
      "Logística y Cadena de Suministro",
      "Maestria Logistica y Cadena de Suministro",
      "Maestria en Logistica y Cadena de Suministro",
      "Maestría en Logística y Cadena de Suministro",
    ],
  },
  {
    canonical: "Bachillerato General - Formación en Administración (2 años)",
    aliases: [
      "Prepa 2",
      "Prepa 2 anos",
      "Prepa_2 años",
      "Bachillerato 2",
      "Bachillerato 2 anos",
      "Bachillerato General Formacion en Administracion 2 Anos",
      "Bachillerato General - Formacion en Administracion (2 Años)",
    ],
  },
  {
    canonical: "Bachillerato General - Formación en Administración (3 años)",
    aliases: [
      "Prepa 3",
      "Prepa 3 anos",
      "Bachillerato 3",
      "Bachillerato 3 anos",
      "Bachillerato General Formacion en Administracion 3 Anos",
      "Bachillerato General - Formacion en Administracion (3 Años)",
    ],
  },
  {
    canonical: "Bachillerato General - Formación en Administración (2 y 3 años)",
    aliases: [
      "Prepa 2 y 3",
      "Prepa 2 y 3 anos",
      "Bachillerato 2 y 3",
      "Bachillerato 2 y 3 anos",
      "Bachillerato General Formacion en Administracion 2 y 3 Anos",
      "Bachillerato General - Formacion en Administracion (2 y 3 Años)",
    ],
  },
  {
    canonical: "Bachillerato General - Formación en Administración Online",
    aliases: [
      "Prepa Online",
      "Bachillerato Online",
      "Bachillerato General Formacion en Administracion Online",
      "Bachillerato General - Formacion en Administracion Online",
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

export type NormalizeAcademicProgramOptions = {
  level?: string | null;
  businessLine?: string | null;
  delivery?: string | null;
  pricingPlans?: number[] | null;
};

function contextKey(options?: NormalizeAcademicProgramOptions): string {
  return baseProgramKey(
    [
      options?.level,
      options?.businessLine,
      options?.delivery,
      ...(options?.pricingPlans ?? []),
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" "),
  );
}

function hasAnyToken(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function polishProgramSubject(input: string) {
  return input
    .replace(/\bAdministracion\b/gi, "Administración")
    .replace(/\bComunicacion\b/gi, "Comunicación")
    .replace(/\bContaduria\b/gi, "Contaduría")
    .replace(/\bDiseno\b/gi, "Diseño")
    .replace(/\bEducacion\b/gi, "Educación")
    .replace(/\bEconomia\b/gi, "Economía")
    .replace(/\bEnfermeria\b/gi, "Enfermería")
    .replace(/\bEnergias\b/gi, "Energías")
    .replace(/\bEstrategico\b/gi, "Estratégico")
    .replace(/\bFisica\b/gi, "Física")
    .replace(/\bGestion\b/gi, "Gestión")
    .replace(/\bGrafico\b/gi, "Gráfico")
    .replace(/\bIngenieria\b/gi, "Ingeniería")
    .replace(/\bInnovacion\b/gi, "Innovación")
    .replace(/\bInteraccion\b/gi, "Interacción")
    .replace(/\bLogistica\b/gi, "Logística")
    .replace(/\bMercadotecnia\b/gi, "Mercadotecnia")
    .replace(/\bMecadotecnia\b/gi, "Mercadotecnia")
    .replace(/\bNutricion\b/gi, "Nutrición")
    .replace(/\bPedagogia\b/gi, "Pedagogía")
    .replace(/\bPsicologia\b/gi, "Psicología")
    .replace(/\bPublica\b/gi, "Pública")
    .replace(/\bRobotica\b/gi, "Robótica")
    .replace(/\bAutomatizacion\b/gi, "Automatización")
    .replace(/\bTecnologias\b/gi, "Tecnologías")
    .replace(/\bTuristicas\b/gi, "Turísticas")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutAcademicPrefix(name: string, prefixKey: "licenciatura" | "maestria") {
  const cleaned = cleanProgramDisplayName(name);
  if (prefixKey === "licenciatura") {
    return cleaned
      .replace(/^lic\.?\s*(en\s+)?/i, "")
      .replace(/^licenciatura\s*(en\s+)?/i, "")
      .trim();
  }

  return cleaned
    .replace(/^mtr[ia]?\.?\s*(en\s+)?/i, "")
    .replace(/^maestr[ií]a\s*(en\s+)?/i, "")
    .trim();
}

function withLicenciaturaPrefix(name: string) {
  const subject = polishProgramSubject(withoutAcademicPrefix(name, "licenciatura"));
  return subject ? `Licenciatura en ${subject}` : cleanProgramDisplayName(name);
}

function withMaestriaPrefix(name: string) {
  const subject = polishProgramSubject(withoutAcademicPrefix(name, "maestria"));
  return subject ? `Maestría en ${subject}` : cleanProgramDisplayName(name);
}

function isLicenciaturaContext(sourceKey: string, options?: NormalizeAcademicProgramOptions) {
  const ctx = contextKey(options);
  return (
    hasAnyToken(ctx, ["licenciatura", "lic"]) ||
    sourceKey.startsWith("licenciatura ") ||
    sourceKey.startsWith("lic ")
  );
}

function isPosgradoContext(sourceKey: string, options?: NormalizeAcademicProgramOptions) {
  const ctx = contextKey(options);
  return (
    hasAnyToken(ctx, ["posgrado", "maestria", "master"]) ||
    sourceKey.startsWith("maestria ") ||
    sourceKey.startsWith("mtria ") ||
    sourceKey.startsWith("mtr ")
  );
}

function isBachilleratoContext(sourceKey: string, options?: NormalizeAcademicProgramOptions) {
  const ctx = contextKey(options);
  return hasAnyToken(ctx, ["prepa", "bachillerato", "bachiller"]) ||
    hasAnyToken(sourceKey, ["prepa", "bachillerato", "bachiller"]);
}

function normalizeBachilleratoDisplayName(
  sourceKey: string,
  options?: NormalizeAcademicProgramOptions,
) {
  const ctx = contextKey(options);
  const combined = `${sourceKey} ${ctx}`.trim();
  const hasOnline = combined.includes("online");
  const hasTwo = /\b2\b/.test(combined) || combined.includes("dos anos");
  const hasThree = /\b3\b/.test(combined) || combined.includes("tres anos");

  if (hasOnline) {
    return "Bachillerato General - Formación en Administración Online";
  }
  if (hasTwo && hasThree) {
    return "Bachillerato General - Formación en Administración (2 y 3 años)";
  }
  if (hasTwo) {
    return "Bachillerato General - Formación en Administración (2 años)";
  }
  if (hasThree) {
    return "Bachillerato General - Formación en Administración (3 años)";
  }

  return "Bachillerato General - Formación en Administración";
}

function inferCanonicalName(
  cleanedName: string,
  sourceNormalized: string,
  options?: NormalizeAcademicProgramOptions,
) {
  const canonical = canonicalByKey.get(sourceNormalized);
  if (canonical) return canonical;

  if (isBachilleratoContext(sourceNormalized, options)) {
    return normalizeBachilleratoDisplayName(sourceNormalized, options);
  }
  if (isPosgradoContext(sourceNormalized, options)) {
    return withMaestriaPrefix(cleanedName);
  }
  if (isLicenciaturaContext(sourceNormalized, options)) {
    return withLicenciaturaPrefix(cleanedName);
  }

  return cleanedName;
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

export function normalizeAcademicProgramKey(
  input: string | null | undefined,
  options?: NormalizeAcademicProgramOptions,
): string {
  const sourceNormalized = baseProgramKey(input);
  const canonical = inferCanonicalName(cleanProgramDisplayName(input), sourceNormalized, options);
  return canonical ? baseProgramKey(canonical) : sourceNormalized;
}

export function normalizeAcademicProgramName(
  input: string | null | undefined,
  options?: NormalizeAcademicProgramOptions,
): NormalizedAcademicProgramName {
  const cleanedName = cleanProgramDisplayName(input);
  const sourceNormalized = baseProgramKey(cleanedName);
  const canonicalName = inferCanonicalName(cleanedName, sourceNormalized, options);
  const nameNormalized = baseProgramKey(canonicalName);

  return {
    name: canonicalName,
    nameNormalized,
    sourceNormalized,
    wasNormalized: sourceNormalized !== nameNormalized || cleanedName !== canonicalName,
  };
}
