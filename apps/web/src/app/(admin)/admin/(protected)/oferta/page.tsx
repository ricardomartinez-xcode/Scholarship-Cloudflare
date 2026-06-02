import { AdminCapability, AdminConfigModule } from "@prisma/client";

import ConfigPublishPanel from "@/components/admin/ConfigPublishPanel";
import { ACADEMIC_OFFER_CYCLES } from "@/config/academicOffer";
import { getAdminUser, requireAdminCapabilityUser } from "@/lib/admin-session";
import { getAdminConfigModuleMeta } from "@/lib/admin-config-modules";
import { canPublishConfigWithAdmin } from "@/lib/admin-publish-auth";
import { getConfigPublicationState } from "@/lib/admin-config-snapshots";
import { getAcademicOfferVisibleCycles } from "@/lib/academic-offer-config";
import { academicModuleOrDefault } from "@/lib/academic-modules";
import { listProgramOfferingSubjectsById } from "@/lib/program-offering-subjects";
import { prisma } from "@/lib/prisma";
import OfferImportClient from "@/components/admin/OfferImportClient";
import {
  publishConfigModuleAction,
  rollbackConfigVersionAction,
} from "../config-actions";

export const dynamic = "force-dynamic";

function getModalityLabel(offering: {
  delivery: "CAMPUS" | "ONLINE";
  escolarizado: boolean;
  ejecutivo: boolean;
}) {
  if (offering.delivery === "ONLINE") return "Online";
  if (offering.escolarizado && offering.ejecutivo) return "Escolarizado / Ejecutivo";
  if (offering.ejecutivo) return "Ejecutivo";
  if (offering.escolarizado) return "Escolarizado";
  return "Presencial";
}

export default async function OfertaPage() {
  await requireAdminCapabilityUser(AdminCapability.manage_offers);
  const configModule = AdminConfigModule.OFFER;
  const moduleMeta = getAdminConfigModuleMeta(configModule);

  const [admin, publicationState, previewRows, visibleCycles, campuses, programs] =
    await Promise.all([
    getAdminUser(),
    getConfigPublicationState(configModule),
    prisma.programOffering.findMany({
      where: { cycle: { in: [...ACADEMIC_OFFER_CYCLES] } },
      orderBy: [{ cycle: "asc" }, { campus: { name: "asc" } }, { program: { name: "asc" } }],
      take: 400,
      select: {
        id: true,
        cycle: true,
        isActive: true,
        delivery: true,
        escolarizado: true,
        ejecutivo: true,
        escolarizadoSchedule: true,
        ejecutivoSchedule: true,
        lineOfBusiness: true,
        pricingPlans: true,
        track: true,
        campusId: true,
        programId: true,
        campus: { select: { code: true, name: true } },
        program: {
          select: {
            name: true,
            businessLine: true,
            planPdfUrl: true,
            brochurePdfUrl: true,
          },
        },
      },
    }),
    getAcademicOfferVisibleCycles(),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, kind: true },
    }),
    prisma.program.findMany({
      orderBy: [{ name: "asc" }],
      take: 600,
      select: {
        id: true,
        name: true,
        businessLine: true,
        category: true,
        level: true,
        planPdfUrl: true,
        brochurePdfUrl: true,
      },
    }),
  ]);
  const subjectsByOfferingId = await listProgramOfferingSubjectsById(
    previewRows.map((row) => row.id),
  );

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
            Categoría y línea
          </div>
          <p className="mt-2">
            La categoría describe el tipo académico del programa. La línea de negocio
            agrupa el portafolio comercial que usa pricing y beneficios.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Modalidad
          </div>
          <p className="mt-2">
            La modalidad sale de la combinación entre delivery y banderas escolarizado/ejecutivo.
            Online no debe mezclarse con modalidades presenciales.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            PDFs y vigencia
          </div>
          <p className="mt-2">
            Antes de publicar, valida que plan y brochure existan para el ciclo activo.
            Un programa visible sin sus PDFs genera referencias huérfanas en la app pública.
          </p>
        </div>
      </section>
      <OfferImportClient
        initialVisibleCycles={visibleCycles}
        initialPreviewRows={previewRows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          programId: row.programId,
          campusCode: row.campus.code,
          campusName: row.campus.name,
          cycle: row.cycle,
          programName: row.program.name,
          line: row.lineOfBusiness ?? row.program.businessLine ?? null,
          modality: getModalityLabel(row),
          pricingPlans: row.pricingPlans ?? [],
          module: academicModuleOrDefault(row.track),
          subjectsByModule: subjectsByOfferingId.get(row.id) ?? null,
          delivery: row.delivery,
          escolarizado: row.escolarizado,
          ejecutivo: row.ejecutivo,
          escolarizadoSchedule: row.escolarizadoSchedule,
          ejecutivoSchedule: row.ejecutivoSchedule,
          isActive: row.isActive,
          hasPlanPdf: Boolean(row.program.planPdfUrl),
          hasBrochurePdf: Boolean(row.program.brochurePdfUrl),
        }))}
        campusOptions={campuses.map((campus) => ({
          id: campus.id,
          code: campus.code,
          name: campus.name,
          kind: campus.kind,
        }))}
        programOptions={programs.map((program) => ({
          id: program.id,
          name: program.name,
          businessLine: program.businessLine,
          category: program.category,
          level: program.level,
          hasPlanPdf: Boolean(program.planPdfUrl),
          hasBrochurePdf: Boolean(program.brochurePdfUrl),
        }))}
      />
    </div>
  );
}

