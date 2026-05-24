import { AdminCapability, AdminConfigModule } from "@prisma/client";

import ConfigPublishPanel from "@/components/admin/ConfigPublishPanel";
import { getAdminUser, requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { canPublishConfigWithAdmin } from "@/lib/admin-publish-auth";
import { getConfigPublicationState } from "@/lib/admin-config-snapshots";
import { serializeBaseScholarshipRows } from "@/lib/admin-base-scholarships";
import { prisma } from "@/lib/prisma";
import BenefitsClient from "@/components/admin/BenefitsClient";
import {
  publishConfigModuleAction,
  rollbackConfigVersionAction,
} from "../config-actions";
import {
  deleteBaseScholarshipAction,
  deleteBenefitAction,
  upsertBaseScholarshipAction,
  upsertBenefitAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function BenefitsPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_benefits);
  const configModule = AdminConfigModule.BENEFITS;
  const moduleMeta = getAdminConfigModuleMeta(configModule);

  const [admin, publicationState, benefits, campuses, scholarshipRules] = await Promise.all([
    getAdminUser(),
    getConfigPublicationState(configModule),
    prisma.adminAdditionalBenefit.findMany({
      orderBy: [{ updatedAt: "desc" }],
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
        campuses: {
          select: {
            campus: { select: { id: true, name: true, kind: true, sortOrder: true } },
          },
        },
      },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, sortOrder: true, tier: true },
    }),
    prisma.scholarshipRule.findMany({
      orderBy: [
        { enrollmentType: "asc" },
        { businessLine: "asc" },
        { modality: "asc" },
        { plan: "asc" },
        { campusTier: "asc" },
        { minAverage: "asc" },
      ],
      select: {
        id: true,
        enrollmentType: true,
        businessLine: true,
        modality: true,
        plan: true,
        campusTier: true,
        minAverage: true,
        maxAverage: true,
        scholarshipPercent: true,
        discountedPriceMxn: true,
        origin: true,
      },
    }),
  ]);

  const normalizedBenefits = benefits
    .filter((benefit) => benefit.benefitType !== "fixed_scholarship")
    .map((b) => ({
    id: b.id,
    appliesToAll: b.appliesToAll,
    benefitType: b.benefitType as "percentage" | "first_payment",
    enrollmentType: b.enrollmentType,
    extraPercent: b.extraPercent,
    firstPaymentAmount: Number(b.firstPaymentAmount),
    isActive: b.isActive,
    notes: b.notes,
    businessLine: b.businessLine,
    modality: b.modality,
    duration: b.duration,
    campusIds: b.campuses.map((x) => x.campus.id),
    campusNames: b.campuses
      .map((x) => x.campus.name)
      .sort((a, c) => a.localeCompare(c)),
  }));

  return (
    <div className="grid gap-6">
      <ConfigPublishPanel
        module={configModule}
        title={moduleMeta.label}
        description={moduleMeta.description}
        canPublish={canPublishConfigWithAdmin(admin)}
        state={publicationState}
        publishConfigModuleAction={publishConfigModuleAction}
        rollbackConfigVersionAction={rollbackConfigVersionAction}
      />
      <section className="ui-card grid gap-3 p-4 text-sm text-slate-300 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Línea
          </div>
          <p className="mt-2">
            La línea de negocio filtra a qué portafolio aplica el beneficio: salud,
            licenciatura, prepa o posgrado.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Modalidad
          </div>
          <p className="mt-2">
            Modalidad describe cómo se imparte el programa. Úsala para separar presencial,
            mixta y online, no para distinguir turnos o planteles.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Duración
          </div>
          <p className="mt-2">
            Define si el beneficio aplica sólo al primer cuatrimestre, a toda la carrera
            o únicamente al pago inicial.
          </p>
        </div>
      </section>
      <BenefitsClient
        benefits={normalizedBenefits}
        baseScholarships={serializeBaseScholarshipRows(scholarshipRules)}
        campusOptions={campuses.map((c) => ({
          value: c.id,
          label: c.name,
          kind: c.kind,
          tier: c.tier,
        }))}
        upsertBenefitAction={upsertBenefitAction}
        upsertBaseScholarshipAction={upsertBaseScholarshipAction}
        deleteBaseScholarshipAction={deleteBaseScholarshipAction}
        deleteBenefitAction={deleteBenefitAction}
      />
    </div>
  );
}
