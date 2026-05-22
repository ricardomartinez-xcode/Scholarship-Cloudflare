import {
  AdminAdditionalBenefitType,
  AdminConfigModule,
  BenefitBusinessLine,
  BenefitModality,
  EnrollmentType,
  type Prisma,
} from "@prisma/client";

import {
  getPublishedConfigSnapshot,
  type BenefitsDraftSnapshot,
} from "@/lib/admin-config-snapshots";
import { prisma } from "@/lib/prisma";
import { resolveCampus } from "@/lib/campus-resolver";
import type {
  CanonicalBusinessLine,
  CanonicalModalityValue,
} from "@/lib/pricing-normalize";

export type ResolvedAdditionalBenefit = {
  benefitType: AdminAdditionalBenefitType;
  enrollmentType: EnrollmentType | null;
  extraPercent: number;
  firstPaymentAmount: number;
  notes: string | null;
  appliesToAll: boolean;
  businessLine: string | null;
  modality: string | null;
  duration: string | null;
};

export type ResolvedAdditionalBenefits = {
  percentageBenefit: ResolvedAdditionalBenefit | null;
  fixedScholarshipBenefit: ResolvedAdditionalBenefit | null;
  firstPaymentBenefit: ResolvedAdditionalBenefit | null;
};

type BenefitPayload = ResolvedAdditionalBenefit & {
  sortIndex?: number;
  campusIds?: string[];
  updatedAt?: Date;
  isActive?: boolean;
};

function pickBestBenefit(rows: BenefitPayload[]) {
  if (!rows.length) return null;

  const score = (row: BenefitPayload) =>
    (row.businessLine ? 1 : 0) +
    (row.modality ? 1 : 0) +
    (row.enrollmentType ? 1 : 0);

  return rows.reduce<BenefitPayload | null>((best, row) => {
    if (!best) return row;
    const diff = score(row) - score(best);
    if (diff > 0) return row;
    if (diff < 0) return best;

    if (row.sortIndex !== undefined || best.sortIndex !== undefined) {
      const rowIndex = row.sortIndex ?? Number.POSITIVE_INFINITY;
      const bestIndex = best.sortIndex ?? Number.POSITIVE_INFINITY;
      if (rowIndex !== bestIndex) {
        return rowIndex < bestIndex ? row : best;
      }
    }

    if (row.updatedAt && best.updatedAt) {
      if (row.updatedAt.getTime() !== best.updatedAt.getTime()) {
        return row.updatedAt > best.updatedAt ? row : best;
      }
    }

    return best;
  }, null);
}

function stripInternalFields(row: BenefitPayload | null) {
  if (!row) return null;
  const { sortIndex, campusIds, updatedAt, isActive, ...rest } = row;
  void sortIndex;
  void campusIds;
  void updatedAt;
  void isActive;
  return rest;
}

function pickBestByType(params: {
  rows: BenefitPayload[];
  benefitType: AdminAdditionalBenefitType;
  campusId?: string | null;
}) {
  const typed = params.rows.filter((row) => row.benefitType === params.benefitType);
  if (!typed.length) return null;

  const campusId = params.campusId;
  if (campusId) {
    const scoped = pickBestBenefit(
      typed.filter(
        (row) => !row.appliesToAll && row.campusIds?.includes(campusId),
      ),
    );
    if (scoped) return stripInternalFields(scoped);
  }

  return stripInternalFields(
    pickBestBenefit(typed.filter((row) => row.appliesToAll)),
  );
}

function mapSnapshotBenefit(
  benefit: BenefitsDraftSnapshot["benefits"][number],
  index: number,
): BenefitPayload {
  return {
    benefitType: benefit.benefitType ?? AdminAdditionalBenefitType.percentage,
    enrollmentType: benefit.enrollmentType ?? null,
    extraPercent: benefit.extraPercent,
    firstPaymentAmount: benefit.firstPaymentAmount ?? 0,
    notes: benefit.notes,
    appliesToAll: benefit.appliesToAll,
    businessLine: benefit.businessLine,
    modality: benefit.modality,
    duration: benefit.duration,
    sortIndex: index,
    campusIds: benefit.campusIds,
    isActive: benefit.isActive,
  };
}

function matchesScope(params: {
  benefit: BenefitPayload;
  businessLine: BenefitBusinessLine | null;
  modality: BenefitModality | null;
  enrollmentType: EnrollmentType | null;
  campusId?: string | null;
}) {
  const { benefit, businessLine, modality, enrollmentType, campusId } = params;

  const businessLineMatches = businessLine
    ? benefit.businessLine === null || benefit.businessLine === businessLine
    : benefit.businessLine === null;
  const modalityMatches = modality
    ? benefit.modality === null || benefit.modality === modality
    : benefit.modality === null;
  const enrollmentMatches = enrollmentType
    ? benefit.enrollmentType === null || benefit.enrollmentType === enrollmentType
    : benefit.enrollmentType === null;
  const campusMatches = campusId
    ? benefit.appliesToAll || benefit.campusIds?.includes(campusId)
    : benefit.appliesToAll;

  return (
    Boolean(benefit.isActive ?? true) &&
    businessLineMatches &&
    modalityMatches &&
    enrollmentMatches &&
    campusMatches
  );
}

export async function resolveAdditionalBenefits(params: {
  campus?: string | null;
  businessLine?: CanonicalBusinessLine | null;
  modality?: CanonicalModalityValue | null;
  enrollmentType?: EnrollmentType | null;
}): Promise<ResolvedAdditionalBenefits> {
  const campus = params.campus ? await resolveCampus(params.campus) : null;
  const businessLine =
    (params.businessLine as BenefitBusinessLine | null | undefined) ?? null;
  const modality =
    (params.modality as BenefitModality | null | undefined) ?? null;
  const enrollmentType = params.enrollmentType ?? null;

  const published = await getPublishedConfigSnapshot(AdminConfigModule.BENEFITS);
  if (published) {
    const snapshot = published.snapshot as BenefitsDraftSnapshot;
    const candidateRows = snapshot.benefits
      .map((benefit, index) => mapSnapshotBenefit(benefit, index))
      .filter((benefit) =>
        matchesScope({
          benefit,
          businessLine,
          modality,
          enrollmentType,
          campusId: campus?.id ?? null,
        }),
      );

    return {
      percentageBenefit: pickBestByType({
        rows: candidateRows,
        benefitType: AdminAdditionalBenefitType.percentage,
        campusId: campus?.id ?? null,
      }),
      fixedScholarshipBenefit: pickBestByType({
        rows: candidateRows,
        benefitType: AdminAdditionalBenefitType.fixed_scholarship,
        campusId: campus?.id ?? null,
      }),
      firstPaymentBenefit: pickBestByType({
        rows: candidateRows,
        benefitType: AdminAdditionalBenefitType.first_payment,
        campusId: campus?.id ?? null,
      }),
    };
  }

  const scopeFilters: Prisma.AdminAdditionalBenefitWhereInput[] = [
    businessLine
      ? { OR: [{ businessLine: null }, { businessLine }] }
      : { businessLine: null },
    modality ? { OR: [{ modality: null }, { modality }] } : { modality: null },
    enrollmentType
      ? { OR: [{ enrollmentType: null }, { enrollmentType }] }
      : { enrollmentType: null },
  ];

  const rows = await prisma.adminAdditionalBenefit.findMany({
    where: {
      isActive: true,
      AND: scopeFilters,
      ...(campus
        ? {
            OR: [
              { appliesToAll: true },
              { appliesToAll: false, campuses: { some: { campusId: campus.id } } },
            ],
          }
        : { appliesToAll: true }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      benefitType: true,
      enrollmentType: true,
      extraPercent: true,
      firstPaymentAmount: true,
      notes: true,
      appliesToAll: true,
      businessLine: true,
      modality: true,
      duration: true,
      updatedAt: true,
      campuses: {
        select: {
          campusId: true,
        },
      },
    } satisfies Prisma.AdminAdditionalBenefitSelect,
  });

  const candidateRows = rows.map((row) => ({
    ...row,
    firstPaymentAmount: Number(row.firstPaymentAmount),
    campusIds: row.campuses.map((campusRow) => campusRow.campusId),
  }));

  return {
    percentageBenefit: pickBestByType({
      rows: candidateRows,
      benefitType: AdminAdditionalBenefitType.percentage,
      campusId: campus?.id ?? null,
    }),
    fixedScholarshipBenefit: pickBestByType({
      rows: candidateRows,
      benefitType: AdminAdditionalBenefitType.fixed_scholarship,
      campusId: campus?.id ?? null,
    }),
    firstPaymentBenefit: pickBestByType({
      rows: candidateRows,
      benefitType: AdminAdditionalBenefitType.first_payment,
      campusId: campus?.id ?? null,
    }),
  };
}

export async function resolveAdditionalBenefit(params: {
  campus?: string | null;
  businessLine?: CanonicalBusinessLine | null;
  modality?: CanonicalModalityValue | null;
  enrollmentType?: EnrollmentType | null;
}) {
  const resolved = await resolveAdditionalBenefits(params);
  return resolved.percentageBenefit;
}
