import { prisma } from "@/lib/prisma";
import { listActivePublishedPriceOverrides } from "@/lib/published-price-overrides";
import {
  buildCampusAliases,
  type CampusIdentity,
} from "@/lib/campus-resolver";
import {
  toNumber,
  type EnrollmentTypeValue,
} from "@/lib/pricing-normalize";

type FlatRulePayload = {
  programa: string;
  nivel: string;
  modalidad: string;
  plan: number;
  tier: string | null;
  rango: { min: number | null; max: number | null } | null;
  porcentaje: number | null;
  monto: number | null;
  origen: string | null;
};

function toLegacyProgram(enrollmentType: EnrollmentTypeValue) {
  return enrollmentType === "nuevo_ingreso" ? "nuevo_ingreso" : "reingreso";
}

function toLegacyBusinessLine(businessLine: string) {
  return businessLine === "prepa" ? "preparatoria" : businessLine;
}

export async function loadCanonicalFlatRulesPayload(sourceVersion = "legacy") {
  const [rules, overrides] = await Promise.all([
    prisma.scholarshipRule.findMany({
      where: {
        sourceVersion,
        enrollmentType: { in: ["nuevo_ingreso", "reingreso"] },
      },
      orderBy: [
        { enrollmentType: "asc" },
        { businessLine: "asc" },
        { modality: "asc" },
        { plan: "asc" },
        { campusTier: "asc" },
        { minAverage: "asc" },
      ],
    }),
    listActivePublishedPriceOverrides(),
  ]);

  const overrideMap = new Map<string, number>();
  for (const override of overrides) {
    const keys = override.targetKeys as Record<string, string>;
    const key = `${keys.programa_key}|${keys.nivel_key}|${keys.modalidad_key}|${keys.plan}|${keys.tier}`;
    overrideMap.set(key, Number(override.newPrice));
  }

  return rules.map<FlatRulePayload>((rule) => {
    const programa = toLegacyProgram(rule.enrollmentType);
    const nivel = toLegacyBusinessLine(rule.businessLine);
    const modalidad = rule.modality;
    const tier = rule.campusTier === "ANY" ? null : rule.campusTier;
    const overrideKey = `${programa}|${nivel}|${modalidad}|${rule.plan}|${tier ?? ""}`;

    return {
      programa,
      nivel,
      modalidad,
      plan: rule.plan,
      tier,
      rango:
        rule.minAverage !== null || rule.maxAverage !== null
          ? {
              min: toNumber(rule.minAverage),
              max: toNumber(rule.maxAverage),
            }
          : null,
      porcentaje: toNumber(rule.scholarshipPercent),
      monto:
        overrideMap.get(overrideKey) ?? toNumber(rule.discountedPriceMxn),
      origen: rule.origin,
    };
  });
}

export async function loadCanonicalReturnSubjectPayload(
  campuses: CampusIdentity[],
  sourceVersion = "legacy",
) {
  const rows = await prisma.returnSubjectPrice.findMany({
    where: { sourceVersion },
    orderBy: [
      { campus: { name: "asc" } },
      { modality: "asc" },
      { subjectCount: "asc" },
    ],
    select: {
      modality: true,
      subjectCount: true,
      priceMxn: true,
      legacyPlantelRaw: true,
      campus: {
        select: {
          id: true,
          code: true,
          metaKey: true,
          name: true,
          slug: true,
          tier: true,
          kind: true,
        },
      },
    },
  });

  const materias: Record<string, Record<string, Record<string, number>>> = {};

  for (const row of rows) {
    const aliases = buildCampusAliases(
      row.campus as CampusIdentity,
      row.legacyPlantelRaw,
    );
    const modality = row.modality === "online" ? "online" : "presencial";

    for (const alias of aliases) {
      if (!materias[alias]) materias[alias] = {};
      if (!materias[alias][modality]) materias[alias][modality] = {};
      materias[alias][modality][String(row.subjectCount)] =
        Number(row.priceMxn);
    }
  }

  return { version: sourceVersion, materias };
}
