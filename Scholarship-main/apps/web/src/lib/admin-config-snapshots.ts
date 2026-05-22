import {
  AdminAdditionalBenefitType,
  AdminAuditAction,
  AdminChangeSource,
  AdminConfigModule,
  AdminPlacementBreakpoint,
  AdminPlacementPage,
  AdminPlacementPanel,
  AdminPlacementSection,
  AdminPlacementSlot,
  AdminPublicCtaKind,
  AdminPublicCtaLocation,
  BenefitBusinessLine,
  BusinessEventType,
  BenefitDuration,
  BenefitModality,
  DirectoryContactMethodType,
  EnrollmentType,
  ProgramOfferingDelivery,
  Prisma,
  UserCapability,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { ACADEMIC_OFFER_CYCLES, type AcademicOfferCycle } from "@/config/academicOffer";
import {
  getAcademicOfferVisibleCycles,
  saveAcademicOfferVisibleCycles,
} from "@/lib/academic-offer-config";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminConfigModulePaths } from "@/lib/admin-config-modules";
import { normalizeOfferDraftSnapshot } from "@/lib/offer-draft-snapshot";
import { prisma } from "@/lib/prisma";
import {
  getPublicRouteTagsForModule,
  revalidatePublicRouteTags,
} from "@/lib/public-route-cache";
import { writeBusinessEventSafe } from "@/lib/business-events";

type SnapshotActor = {
  id?: string | null;
  email?: string | null;
};

type DiffKind = "added" | "removed" | "changed";

export type ConfigDiffSummary = {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  draftItems: number;
  publishedItems: number;
  examples: Array<{
    kind: DiffKind;
    key: string;
    label: string;
  }>;
};

export type PriceOverrideSnapshot = {
  id: string;
  scope: string;
  targetKeys: Prisma.JsonValue;
  newPrice: number;
  isActive: boolean;
  notes: string | null;
  updatedBy: string | null;
};

export type PricesDraftSnapshot = {
  overrides: PriceOverrideSnapshot[];
};

export type BenefitSnapshot = {
  id: string;
  appliesToAll: boolean;
  benefitType: AdminAdditionalBenefitType;
  enrollmentType: EnrollmentType | null;
  extraPercent: number;
  firstPaymentAmount: number;
  isActive: boolean;
  notes: string | null;
  businessLine: BenefitBusinessLine | null;
  modality: BenefitModality | null;
  duration: BenefitDuration | null;
  updatedBy: string | null;
  campusIds: string[];
};

export type BenefitsDraftSnapshot = {
  benefits: BenefitSnapshot[];
};

export type PublicCtaSnapshot = {
  id: string;
  label: string;
  kind: AdminPublicCtaKind;
  location: AdminPublicCtaLocation;
  placementPage: AdminPlacementPage;
  placementSection: AdminPlacementSection;
  placementPanel: AdminPlacementPanel;
  placementSlot: AdminPlacementSlot;
  placementBreakpoint: AdminPlacementBreakpoint;
  placementOrder: number;
  url: string | null;
  isActive: boolean;
  sortOrder: number;
  variant: string | null;
  organizationId?: string | null;
  onlyNewUsers?: boolean;
  requiredCapability?: UserCapability | null;
  visibilityRule?: Prisma.JsonValue | null;
  updatedBy: string | null;
};

export type CtasDraftSnapshot = {
  ctas: PublicCtaSnapshot[];
};

export type SidebarInfoSnapshot = {
  id: string;
  key: string;
  value: string;
  isActive: boolean;
  updatedBy: string | null;
};

export type SidebarDraftSnapshot = {
  items: SidebarInfoSnapshot[];
};

export type DirectoryContactMethodSnapshot = {
  id: string;
  type: DirectoryContactMethodType;
  value: string;
  normalizedValue: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type DirectoryContactSnapshot = {
  id: string;
  campusId: string;
  zone: string | null;
  role: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  contactLabel: string | null;
  source: string | null;
  methods: DirectoryContactMethodSnapshot[];
};

export type DirectoryDraftSnapshot = {
  contacts: DirectoryContactSnapshot[];
};

export type OfferCampusSnapshot = {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier: string | null;
  kind: "campus" | "online";
  isActive: boolean;
};

export type OfferProgramSnapshot = {
  id: string;
  name: string;
  nameNormalized: string;
  level: string | null;
  category: string | null;
  planDriveFileId: string | null;
  planDriveLink: string | null;
  planUrl: string | null;
  businessLine: BenefitBusinessLine | null;
  planPdfUrl: string | null;
  brochurePdfUrl: string | null;
};

export type OfferProgramOfferingSnapshot = {
  id: string;
  campusId: string;
  programId: string;
  cycle: string;
  track: string | null;
  delivery: ProgramOfferingDelivery;
  escolarizado: boolean;
  ejecutivo: boolean;
  escolarizadoSchedule: string | null;
  ejecutivoSchedule: string | null;
  lineOfBusiness: string | null;
  isActive: boolean;
  archivedReason: string | null;
  updatedBy: string | null;
};

export type OfferDraftSnapshot = {
  cycles: AcademicOfferCycle[];
  visibleCycles: AcademicOfferCycle[];
  campuses: OfferCampusSnapshot[];
  programs: OfferProgramSnapshot[];
  offerings: OfferProgramOfferingSnapshot[];
};

export type AdminConfigSnapshot =
  | BenefitsDraftSnapshot
  | PricesDraftSnapshot
  | CtasDraftSnapshot
  | SidebarDraftSnapshot
  | DirectoryDraftSnapshot
  | OfferDraftSnapshot;

type DiffItem = {
  key: string;
  label: string;
  payload: unknown;
};

export type ConfigVersionListItem = {
  id: string;
  createdAt: Date;
  publishedAt: Date | null;
  createdByEmail: string | null;
  publishedByEmail: string | null;
  notes: string | null;
  diffSummary: ConfigDiffSummary | null;
};

export type ConfigPublicationState = {
  module: AdminConfigModule;
  draftCount: number;
  publishedCount: number;
  publishedVersionId: string | null;
  publishedAt: Date | null;
  publishedByEmail: string | null;
  diffSummary: ConfigDiffSummary;
  recentVersions: ConfigVersionListItem[];
};

type PublishedSnapshotRecord = {
  versionId: string;
  publishedAt: Date | null;
  publishedByEmail: string | null;
  snapshot: AdminConfigSnapshot;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

function buildDiffSummary(beforeItems: DiffItem[], afterItems: DiffItem[]): ConfigDiffSummary {
  const beforeMap = new Map(beforeItems.map((item) => [item.key, item]));
  const afterMap = new Map(afterItems.map((item) => [item.key, item]));
  const allKeys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();

  const examples: ConfigDiffSummary["examples"] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const key of allKeys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    if (!before && after) {
      added += 1;
      if (examples.length < 6) {
        examples.push({ kind: "added", key, label: after.label });
      }
      continue;
    }
    if (before && !after) {
      removed += 1;
      if (examples.length < 6) {
        examples.push({ kind: "removed", key, label: before.label });
      }
      continue;
    }
    if (!before || !after) continue;
    if (stableStringify(before.payload) !== stableStringify(after.payload)) {
      changed += 1;
      if (examples.length < 6) {
        examples.push({ kind: "changed", key, label: after.label });
      }
      continue;
    }
    unchanged += 1;
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    draftItems: afterItems.length,
    publishedItems: beforeItems.length,
    examples,
  };
}

async function assertCampusesExist(campusIds: string[]) {
  const uniqueIds = Array.from(new Set(campusIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  const existing = await prisma.campus.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((campus) => campus.id));
  const missing = uniqueIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `No se puede restaurar el snapshot porque faltan planteles requeridos: ${missing.join(", ")}.`,
    );
  }
}

async function capturePricesSnapshot(): Promise<PricesDraftSnapshot> {
  const overrides = await prisma.adminPriceOverride.findMany({
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      scope: true,
      targetKeys: true,
      newPrice: true,
      isActive: true,
      notes: true,
      updatedBy: true,
    },
  });

  return {
    overrides: overrides.map((override) => ({
      id: override.id,
      scope: override.scope,
      targetKeys: cloneJson(override.targetKeys),
      newPrice: Number(override.newPrice),
      isActive: override.isActive,
      notes: override.notes,
      updatedBy: override.updatedBy,
    })),
  };
}

async function restorePricesSnapshot(snapshot: PricesDraftSnapshot) {
  await prisma.$transaction(async (tx) => {
    await tx.adminPriceOverride.deleteMany({});
    if (!snapshot.overrides.length) return;
    await tx.adminPriceOverride.createMany({
      data: snapshot.overrides.map((override) => ({
        id: override.id,
        scope: override.scope,
        targetKeys: override.targetKeys as Prisma.InputJsonValue,
        newPrice: override.newPrice,
        isActive: override.isActive,
        notes: override.notes,
        updatedBy: override.updatedBy,
      })),
    });
  });
}

async function captureBenefitsSnapshot(): Promise<BenefitsDraftSnapshot> {
  const benefits = await prisma.adminAdditionalBenefit.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      appliesToAll: true,
      benefitType: true,
      enrollmentType: true,
      extraPercent: true,
      firstPaymentAmount: true,
      isActive: true,
      notes: true,
      businessLine: true,
      modality: true,
      duration: true,
      updatedBy: true,
      campuses: {
        orderBy: [{ campusId: "asc" }],
        select: { campusId: true },
      },
    },
  });

  return {
    benefits: benefits.map((benefit) => ({
      id: benefit.id,
      appliesToAll: benefit.appliesToAll,
      benefitType: benefit.benefitType,
      enrollmentType: benefit.enrollmentType,
      extraPercent: benefit.extraPercent,
      firstPaymentAmount: Number(benefit.firstPaymentAmount),
      isActive: benefit.isActive,
      notes: benefit.notes,
      businessLine: benefit.businessLine,
      modality: benefit.modality,
      duration: benefit.duration,
      updatedBy: benefit.updatedBy,
      campusIds: benefit.campuses.map((campus) => campus.campusId),
    })),
  };
}

async function restoreBenefitsSnapshot(snapshot: BenefitsDraftSnapshot) {
  await assertCampusesExist(snapshot.benefits.flatMap((benefit) => benefit.campusIds));
  await prisma.$transaction(async (tx) => {
    await tx.adminAdditionalBenefitCampus.deleteMany({});
    await tx.adminAdditionalBenefit.deleteMany({});
    if (!snapshot.benefits.length) return;
    await tx.adminAdditionalBenefit.createMany({
      data: snapshot.benefits.map((benefit) => ({
        id: benefit.id,
        appliesToAll: benefit.appliesToAll,
        benefitType: benefit.benefitType,
        enrollmentType: benefit.enrollmentType,
        extraPercent: benefit.extraPercent,
        firstPaymentAmount: benefit.firstPaymentAmount,
        isActive: benefit.isActive,
        notes: benefit.notes,
        businessLine: benefit.businessLine,
        modality: benefit.modality,
        duration: benefit.duration,
        updatedBy: benefit.updatedBy,
      })),
    });
    const campusLinks = snapshot.benefits.flatMap((benefit) =>
      benefit.campusIds.map((campusId) => ({ benefitId: benefit.id, campusId })),
    );
    if (campusLinks.length) {
      await tx.adminAdditionalBenefitCampus.createMany({ data: campusLinks });
    }
  });
}

async function captureCtasSnapshot(): Promise<CtasDraftSnapshot> {
  const ctas = await prisma.adminPublicCta.findMany({
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      kind: true,
      location: true,
      placementPage: true,
      placementSection: true,
      placementPanel: true,
      placementSlot: true,
      placementBreakpoint: true,
      placementOrder: true,
      url: true,
      isActive: true,
      sortOrder: true,
      variant: true,
      organizationId: true,
      onlyNewUsers: true,
      requiredCapability: true,
      visibilityRule: true,
      updatedBy: true,
    },
  });

  return {
    ctas: ctas.map((cta) => ({
      id: cta.id,
      label: cta.label,
      kind: cta.kind,
      location: cta.location,
      placementPage: cta.placementPage,
      placementSection: cta.placementSection,
      placementPanel: cta.placementPanel,
      placementSlot: cta.placementSlot,
      placementBreakpoint: cta.placementBreakpoint,
      placementOrder: cta.placementOrder,
      url: cta.url,
      isActive: cta.isActive,
      sortOrder: cta.sortOrder,
      variant: cta.variant,
      organizationId: cta.organizationId,
      onlyNewUsers: cta.onlyNewUsers,
      requiredCapability: cta.requiredCapability,
      visibilityRule: cloneJson(cta.visibilityRule),
      updatedBy: cta.updatedBy,
    })),
  };
}

async function restoreCtasSnapshot(snapshot: CtasDraftSnapshot) {
  await prisma.$transaction(async (tx) => {
    await tx.adminPublicCta.deleteMany({});
    if (!snapshot.ctas.length) return;
    await tx.adminPublicCta.createMany({
      data: snapshot.ctas.map((cta) => ({
        id: cta.id,
        label: cta.label,
        kind: cta.kind,
        location: cta.location,
        placementPage: cta.placementPage,
        placementSection: cta.placementSection,
        placementPanel: cta.placementPanel,
        placementSlot: cta.placementSlot,
        placementBreakpoint: cta.placementBreakpoint,
        placementOrder: cta.placementOrder,
        url: cta.url,
        isActive: cta.isActive,
        sortOrder: cta.sortOrder,
        variant: cta.variant,
        organizationId: cta.organizationId ?? null,
        onlyNewUsers: cta.onlyNewUsers ?? false,
        requiredCapability: cta.requiredCapability ?? null,
        visibilityRule:
          cta.visibilityRule === null || cta.visibilityRule === undefined
            ? Prisma.JsonNull
            : (cta.visibilityRule as Prisma.InputJsonValue),
        updatedBy: cta.updatedBy,
      })),
    });
  });
}

async function captureSidebarSnapshot(): Promise<SidebarDraftSnapshot> {
  const items = await prisma.adminSidebarInfo.findMany({
    orderBy: [{ key: "asc" }],
    select: {
      id: true,
      key: true,
      value: true,
      isActive: true,
      updatedBy: true,
    },
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      key: item.key,
      value: item.value,
      isActive: item.isActive,
      updatedBy: item.updatedBy,
    })),
  };
}

async function restoreSidebarSnapshot(snapshot: SidebarDraftSnapshot) {
  await prisma.$transaction(async (tx) => {
    await tx.adminSidebarInfo.deleteMany({});
    if (!snapshot.items.length) return;
    await tx.adminSidebarInfo.createMany({
      data: snapshot.items.map((item) => ({
        id: item.id,
        key: item.key,
        value: item.value,
        isActive: item.isActive,
        updatedBy: item.updatedBy,
      })),
    });
  });
}

async function captureDirectorySnapshot(): Promise<DirectoryDraftSnapshot> {
  const contacts = await prisma.directoryContact.findMany({
    orderBy: [{ campus: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      campusId: true,
      zone: true,
      role: true,
      name: true,
      email: true,
      phone: true,
      contactLabel: true,
      source: true,
      methods: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          value: true,
          normalizedValue: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
    },
  });

  return {
    contacts: contacts.map((contact) => ({
      id: contact.id,
      campusId: contact.campusId,
      zone: contact.zone,
      role: contact.role,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      contactLabel: contact.contactLabel,
      source: contact.source,
      methods: contact.methods.map((method) => ({
        id: method.id,
        type: method.type,
        value: method.value,
        normalizedValue: method.normalizedValue,
        isPrimary: method.isPrimary,
        sortOrder: method.sortOrder,
      })),
    })),
  };
}

async function restoreDirectorySnapshot(snapshot: DirectoryDraftSnapshot) {
  await assertCampusesExist(snapshot.contacts.map((contact) => contact.campusId));
  await prisma.$transaction(async (tx) => {
    await tx.directoryContactMethod.deleteMany({});
    await tx.directoryContact.deleteMany({});
    if (!snapshot.contacts.length) return;
    await tx.directoryContact.createMany({
      data: snapshot.contacts.map((contact) => ({
        id: contact.id,
        campusId: contact.campusId,
        zone: contact.zone,
        role: contact.role,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        contactLabel: contact.contactLabel,
        source: contact.source,
      })),
    });
    const methods = snapshot.contacts.flatMap((contact) =>
      contact.methods.map((method) => ({
        id: method.id,
        directoryContactId: contact.id,
        type: method.type,
        value: method.value,
        normalizedValue: method.normalizedValue,
        isPrimary: method.isPrimary,
        sortOrder: method.sortOrder,
      })),
    );
    if (methods.length) {
      await tx.directoryContactMethod.createMany({ data: methods });
    }
  });
}

async function captureOfferSnapshot(): Promise<OfferDraftSnapshot> {
  const offerings = await prisma.programOffering.findMany({
    where: {
      cycle: {
        in: [...ACADEMIC_OFFER_CYCLES],
      },
    },
    orderBy: [{ campus: { name: "asc" } }, { program: { name: "asc" } }],
    select: {
      id: true,
      campusId: true,
      programId: true,
      cycle: true,
      track: true,
      delivery: true,
      escolarizado: true,
      ejecutivo: true,
      escolarizadoSchedule: true,
      ejecutivoSchedule: true,
      lineOfBusiness: true,
      isActive: true,
      archivedReason: true,
      updatedBy: true,
      campus: {
        select: {
          id: true,
          code: true,
          metaKey: true,
          name: true,
          slug: true,
          tier: true,
          kind: true,
          isActive: true,
        },
      },
      program: {
        select: {
          id: true,
          name: true,
          nameNormalized: true,
          level: true,
          category: true,
          planDriveFileId: true,
          planDriveLink: true,
          planUrl: true,
          businessLine: true,
          planPdfUrl: true,
          brochurePdfUrl: true,
        },
      },
    },
  });

  const campusMap = new Map<string, OfferCampusSnapshot>();
  const programMap = new Map<string, OfferProgramSnapshot>();
  const cycleSet = new Set<AcademicOfferCycle>();
  const visibleCycles = await getAcademicOfferVisibleCycles();

  for (const offering of offerings) {
    if (ACADEMIC_OFFER_CYCLES.includes(offering.cycle as AcademicOfferCycle)) {
      cycleSet.add(offering.cycle as AcademicOfferCycle);
    }
    if (!campusMap.has(offering.campus.id)) {
      campusMap.set(offering.campus.id, {
        id: offering.campus.id,
        code: offering.campus.code,
        metaKey: offering.campus.metaKey,
        name: offering.campus.name,
        slug: offering.campus.slug,
        tier: offering.campus.tier,
        kind: offering.campus.kind,
        isActive: offering.campus.isActive,
      });
    }
    if (!programMap.has(offering.program.id)) {
      programMap.set(offering.program.id, {
        id: offering.program.id,
        name: offering.program.name,
        nameNormalized: offering.program.nameNormalized,
        level: offering.program.level,
        category: offering.program.category,
        planDriveFileId: offering.program.planDriveFileId,
        planDriveLink: offering.program.planDriveLink,
        planUrl: offering.program.planUrl,
        businessLine: offering.program.businessLine,
        planPdfUrl: offering.program.planPdfUrl,
        brochurePdfUrl: offering.program.brochurePdfUrl,
      });
    }
  }

  return {
    cycles: Array.from(cycleSet).sort(
      (left, right) => ACADEMIC_OFFER_CYCLES.indexOf(left) - ACADEMIC_OFFER_CYCLES.indexOf(right),
    ),
    visibleCycles,
    campuses: Array.from(campusMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "es"),
    ),
    programs: Array.from(programMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "es"),
    ),
    offerings: offerings.map((offering) => ({
      id: offering.id,
      campusId: offering.campusId,
      programId: offering.programId,
      cycle: offering.cycle,
      track: offering.track,
      delivery: offering.delivery,
      escolarizado: offering.escolarizado,
      ejecutivo: offering.ejecutivo,
      escolarizadoSchedule: offering.escolarizadoSchedule,
      ejecutivoSchedule: offering.ejecutivoSchedule,
      lineOfBusiness: offering.lineOfBusiness,
      isActive: offering.isActive,
      archivedReason: offering.archivedReason,
      updatedBy: offering.updatedBy,
    })),
  };
}

async function restoreOfferSnapshot(snapshot: OfferDraftSnapshot) {
  await assertCampusesExist(snapshot.campuses.map((campus) => campus.id));
  await prisma.$transaction(async (tx) => {
    for (const campus of snapshot.campuses) {
      await tx.campus.update({
        where: { id: campus.id },
        data: { name: campus.name, isActive: campus.isActive, tier: campus.tier },
      });
    }

    for (const program of snapshot.programs) {
      await tx.program.upsert({
        where: { id: program.id },
        update: {
          name: program.name,
          nameNormalized: program.nameNormalized,
          level: program.level,
          category: program.category,
          planDriveFileId: program.planDriveFileId,
          planDriveLink: program.planDriveLink,
          planUrl: program.planUrl,
          businessLine: program.businessLine,
          planPdfUrl: program.planPdfUrl,
          brochurePdfUrl: program.brochurePdfUrl,
        },
        create: {
          id: program.id,
          name: program.name,
          nameNormalized: program.nameNormalized,
          level: program.level,
          category: program.category,
          planDriveFileId: program.planDriveFileId,
          planDriveLink: program.planDriveLink,
          planUrl: program.planUrl,
          businessLine: program.businessLine,
          planPdfUrl: program.planPdfUrl,
          brochurePdfUrl: program.brochurePdfUrl,
        },
      });
    }

    await tx.programOffering.deleteMany({
      where: {
        cycle: {
          in: snapshot.cycles.length ? snapshot.cycles : [...ACADEMIC_OFFER_CYCLES],
        },
      },
    });
    if (!snapshot.offerings.length) return;
    await tx.programOffering.createMany({
      data: snapshot.offerings.map((offering) => ({
        id: offering.id,
        campusId: offering.campusId,
        programId: offering.programId,
        cycle: offering.cycle,
        track: offering.track,
        delivery: offering.delivery,
        escolarizado: offering.escolarizado,
        ejecutivo: offering.ejecutivo,
        escolarizadoSchedule: offering.escolarizadoSchedule,
        ejecutivoSchedule: offering.ejecutivoSchedule,
        lineOfBusiness: offering.lineOfBusiness,
        isActive: offering.isActive,
        archivedReason: offering.archivedReason,
        updatedBy: offering.updatedBy,
        })),
    });
  });
  await saveAcademicOfferVisibleCycles(snapshot.visibleCycles, "system:restore-offer-snapshot");
}

function asPricesSnapshot(snapshot: AdminConfigSnapshot): PricesDraftSnapshot {
  return snapshot as PricesDraftSnapshot;
}

function asBenefitsSnapshot(snapshot: AdminConfigSnapshot): BenefitsDraftSnapshot {
  return snapshot as BenefitsDraftSnapshot;
}

function asCtasSnapshot(snapshot: AdminConfigSnapshot): CtasDraftSnapshot {
  return snapshot as CtasDraftSnapshot;
}

function asSidebarSnapshot(snapshot: AdminConfigSnapshot): SidebarDraftSnapshot {
  return snapshot as SidebarDraftSnapshot;
}

function asDirectorySnapshot(snapshot: AdminConfigSnapshot): DirectoryDraftSnapshot {
  return snapshot as DirectoryDraftSnapshot;
}

function asOfferSnapshot(snapshot: AdminConfigSnapshot): OfferDraftSnapshot {
  return normalizeOfferDraftSnapshot(snapshot as Partial<OfferDraftSnapshot>);
}

function priceDiffItems(snapshot: PricesDraftSnapshot): DiffItem[] {
  return snapshot.overrides.map((override) => {
    const keys =
      typeof override.targetKeys === "object" && override.targetKeys
        ? (override.targetKeys as Record<string, string | null | undefined>)
        : {};
    const label = [
      override.scope,
      keys.programa_key ?? "",
      keys.nivel_key ?? "",
      keys.modalidad_key ?? "",
      keys.plan ?? "",
      keys.tier ?? "",
    ]
      .filter(Boolean)
      .join(" · ");
    return { key: `price:${override.id}`, label, payload: override };
  });
}

function benefitDiffItems(snapshot: BenefitsDraftSnapshot): DiffItem[] {
  return snapshot.benefits.map((benefit) => ({
    key: `benefit:${benefit.id}`,
    label: [
      benefit.benefitType === "first_payment"
        ? `Primer pago ${benefit.firstPaymentAmount}`
        : `${benefit.extraPercent}%`,
      benefit.enrollmentType ?? "cualquier ingreso",
      benefit.businessLine ?? "todas las lineas",
      benefit.modality ?? "todas las modalidades",
      benefit.duration ?? "cualquier duracion",
    ].join(" · "),
    payload: benefit,
  }));
}

function ctaDiffItems(snapshot: CtasDraftSnapshot): DiffItem[] {
  return snapshot.ctas.map((cta) => ({
    key: `cta:${cta.id}`,
    label: `${cta.placementPage}/${cta.placementSection}/${cta.placementSlot} · ${cta.label}`,
    payload: cta,
  }));
}

function sidebarDiffItems(snapshot: SidebarDraftSnapshot): DiffItem[] {
  return snapshot.items.map((item) => ({
    key: `sidebar:${item.id}`,
    label: item.key,
    payload: item,
  }));
}

function directoryDiffItems(snapshot: DirectoryDraftSnapshot): DiffItem[] {
  return snapshot.contacts.map((contact) => ({
    key: `directory:${contact.id}`,
    label: [contact.role ?? "sin rol", contact.name ?? "sin nombre", contact.campusId].join(
      " · ",
    ),
    payload: contact,
  }));
}

function offerDiffItems(snapshot: OfferDraftSnapshot): DiffItem[] {
  return [
    ...snapshot.visibleCycles.map((cycle) => ({
      key: `offer:visible-cycle:${cycle}`,
      label: `Ciclo visible · ${cycle}`,
      payload: { cycle, visible: true },
    })),
    ...snapshot.campuses.map((campus) => ({
      key: `offer:campus:${campus.id}`,
      label: `Campus · ${campus.code} · ${campus.name}`,
      payload: campus,
    })),
    ...snapshot.programs.map((program) => ({
      key: `offer:program:${program.id}`,
      label: `Programa · ${program.name}`,
      payload: program,
    })),
    ...snapshot.offerings.map((offering) => ({
      key: `offer:offering:${offering.id}`,
      label: `Oferta · ${offering.cycle} · ${offering.campusId} · ${offering.programId}`,
      payload: offering,
    })),
  ];
}

function getSnapshotDiffItems(
  module: AdminConfigModule,
  snapshot: AdminConfigSnapshot,
): DiffItem[] {
  switch (module) {
    case AdminConfigModule.PRICES:
      return priceDiffItems(asPricesSnapshot(snapshot));
    case AdminConfigModule.BENEFITS:
      return benefitDiffItems(asBenefitsSnapshot(snapshot));
    case AdminConfigModule.CTAS:
      return ctaDiffItems(asCtasSnapshot(snapshot));
    case AdminConfigModule.SIDEBAR:
      return sidebarDiffItems(asSidebarSnapshot(snapshot));
    case AdminConfigModule.DIRECTORY:
      return directoryDiffItems(asDirectorySnapshot(snapshot));
    case AdminConfigModule.OFFER:
      return offerDiffItems(asOfferSnapshot(snapshot));
    default:
      return [];
  }
}

export async function captureDraftConfigSnapshot(
  module: AdminConfigModule,
): Promise<AdminConfigSnapshot> {
  switch (module) {
    case AdminConfigModule.PRICES:
      return capturePricesSnapshot();
    case AdminConfigModule.BENEFITS:
      return captureBenefitsSnapshot();
    case AdminConfigModule.CTAS:
      return captureCtasSnapshot();
    case AdminConfigModule.SIDEBAR:
      return captureSidebarSnapshot();
    case AdminConfigModule.DIRECTORY:
      return captureDirectorySnapshot();
    case AdminConfigModule.OFFER:
      return captureOfferSnapshot();
    default:
      throw new Error(`El módulo ${module} no soporta snapshots de configuración.`);
  }
}

export async function restoreDraftConfigSnapshot(
  module: AdminConfigModule,
  snapshot: AdminConfigSnapshot,
) {
  switch (module) {
    case AdminConfigModule.PRICES:
      return restorePricesSnapshot(asPricesSnapshot(snapshot));
    case AdminConfigModule.BENEFITS:
      return restoreBenefitsSnapshot(asBenefitsSnapshot(snapshot));
    case AdminConfigModule.CTAS:
      return restoreCtasSnapshot(asCtasSnapshot(snapshot));
    case AdminConfigModule.SIDEBAR:
      return restoreSidebarSnapshot(asSidebarSnapshot(snapshot));
    case AdminConfigModule.DIRECTORY:
      return restoreDirectorySnapshot(asDirectorySnapshot(snapshot));
    case AdminConfigModule.OFFER:
      return restoreOfferSnapshot(asOfferSnapshot(snapshot));
    default:
      throw new Error(`El módulo ${module} no soporta restore de snapshots.`);
  }
}

export async function getPublishedConfigSnapshot(
  module: AdminConfigModule,
): Promise<PublishedSnapshotRecord | null> {
  const published = await prisma.adminPublishedConfig.findUnique({
    where: { module },
    select: {
      versionId: true,
      version: {
        select: {
          publishedAt: true,
          publishedByEmail: true,
          snapshot: true,
        },
      },
    },
  });

  if (!published) return null;
  return {
    versionId: published.versionId,
    publishedAt: published.version.publishedAt,
    publishedByEmail: published.version.publishedByEmail,
    snapshot: cloneJson(published.version.snapshot) as AdminConfigSnapshot,
  };
}

export function compareConfigSnapshots(
  module: AdminConfigModule,
  previous: AdminConfigSnapshot | null,
  current: AdminConfigSnapshot,
) {
  const previousItems = previous ? getSnapshotDiffItems(module, previous) : [];
  const currentItems = getSnapshotDiffItems(module, current);
  return buildDiffSummary(previousItems, currentItems);
}

function revalidateModulePaths(module: AdminConfigModule) {
  for (const path of getAdminConfigModulePaths(module)) {
    revalidatePath(path);
  }
  revalidatePublicRouteTags(getPublicRouteTagsForModule(module));
}

export async function getConfigPublicationState(
  module: AdminConfigModule,
): Promise<ConfigPublicationState> {
  const [draftSnapshot, publishedSnapshot, recentVersions] = await Promise.all([
    captureDraftConfigSnapshot(module),
    getPublishedConfigSnapshot(module),
    prisma.adminConfigVersion.findMany({
      where: { module },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        createdAt: true,
        publishedAt: true,
        createdByEmail: true,
        publishedByEmail: true,
        notes: true,
        diffSummary: true,
      },
    }),
  ]);

  const diffSummary = compareConfigSnapshots(
    module,
    publishedSnapshot?.snapshot ?? null,
    draftSnapshot,
  );

  return {
    module,
    draftCount: getSnapshotDiffItems(module, draftSnapshot).length,
    publishedCount: publishedSnapshot
      ? getSnapshotDiffItems(module, publishedSnapshot.snapshot).length
      : 0,
    publishedVersionId: publishedSnapshot?.versionId ?? null,
    publishedAt: publishedSnapshot?.publishedAt ?? null,
    publishedByEmail: publishedSnapshot?.publishedByEmail ?? null,
    diffSummary,
    recentVersions: recentVersions.map((version) => ({
      id: version.id,
      createdAt: version.createdAt,
      publishedAt: version.publishedAt,
      createdByEmail: version.createdByEmail,
      publishedByEmail: version.publishedByEmail,
      notes: version.notes,
      diffSummary: version.diffSummary
        ? (cloneJson(version.diffSummary) as ConfigDiffSummary)
        : null,
    })),
  };
}

export async function publishDraftConfigModule(params: {
  module: AdminConfigModule;
  actor: SnapshotActor;
  source?: AdminChangeSource;
  importSessionId?: string | null;
  notes?: string | null;
}) {
  const draftSnapshot = await captureDraftConfigSnapshot(params.module);
  const previousPublished = await getPublishedConfigSnapshot(params.module);
  const diffSummary = compareConfigSnapshots(
    params.module,
    previousPublished?.snapshot ?? null,
    draftSnapshot,
  );

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.adminConfigVersion.create({
      data: {
        module: params.module,
        source: params.source ?? AdminChangeSource.UI,
        snapshot: draftSnapshot as Prisma.InputJsonValue,
        diffSummary,
        summary: diffSummary,
        notes: params.notes ?? null,
        createdByUserId: params.actor.id ?? null,
        createdByEmail: params.actor.email ?? null,
        publishedAt: new Date(),
        publishedByUserId: params.actor.id ?? null,
        publishedByEmail: params.actor.email ?? null,
        importSessionId: params.importSessionId ?? null,
      },
      select: { id: true, publishedAt: true, publishedByEmail: true },
    });

    await tx.adminPublishedConfig.upsert({
      where: { module: params.module },
      update: {
        versionId: created.id,
        updatedByUserId: params.actor.id ?? null,
        updatedByEmail: params.actor.email ?? null,
      },
      create: {
        module: params.module,
        versionId: created.id,
        updatedByUserId: params.actor.id ?? null,
        updatedByEmail: params.actor.email ?? null,
      },
    });

    return created;
  });

  await writeAdminAuditLog({
    module: params.module,
    action: AdminAuditAction.PUBLISH,
    source: params.source ?? AdminChangeSource.UI,
    actor: params.actor,
    before: previousPublished?.snapshot ?? null,
    after: draftSnapshot,
    diffSummary,
    message: params.notes ?? null,
    importSessionId: params.importSessionId ?? null,
    versionId: version.id,
  });

  if (params.module === AdminConfigModule.OFFER) {
    await writeBusinessEventSafe({
      type: BusinessEventType.OFFER_PUBLISHED,
      userId: params.actor.id ?? null,
      subjectType: "AdminConfigVersion",
      subjectId: version.id,
      metadata: {
        module: params.module,
        publishedAt: version.publishedAt?.toISOString?.() ?? null,
        publishedByEmail: params.actor.email ?? null,
        diffSummary,
      },
    });
  }

  revalidateModulePaths(params.module);
  return {
    ok: true as const,
    versionId: version.id,
    publishedAt: version.publishedAt,
    publishedByEmail: version.publishedByEmail,
    diffSummary,
  };
}

export async function rollbackPublishedConfigModule(params: {
  module: AdminConfigModule;
  versionId: string;
  actor: SnapshotActor;
  notes?: string | null;
}) {
  const targetVersion = await prisma.adminConfigVersion.findFirst({
    where: { id: params.versionId, module: params.module },
    select: {
      id: true,
      snapshot: true,
    },
  });

  if (!targetVersion) {
    throw new Error("No se encontró la versión solicitada para rollback.");
  }

  const currentPublished = await getPublishedConfigSnapshot(params.module);
  const targetSnapshot = cloneJson(targetVersion.snapshot) as AdminConfigSnapshot;

  await restoreDraftConfigSnapshot(params.module, targetSnapshot);

  const published = await publishDraftConfigModule({
    module: params.module,
    actor: params.actor,
    source: AdminChangeSource.SYSTEM,
    notes:
      params.notes?.trim() ||
      `Rollback lógico a la versión ${params.versionId.slice(0, 8)}.`,
  });

  await prisma.adminConfigVersion.update({
    where: { id: published.versionId },
    data: { restoredFromVersionId: targetVersion.id },
  });

  await writeAdminAuditLog({
    module: params.module,
    action: AdminAuditAction.ROLLBACK,
    source: AdminChangeSource.SYSTEM,
    actor: params.actor,
    before: currentPublished?.snapshot ?? null,
    after: targetSnapshot,
    diffSummary: published.diffSummary,
    message: params.notes ?? null,
    versionId: published.versionId,
  });

  return published;
}
