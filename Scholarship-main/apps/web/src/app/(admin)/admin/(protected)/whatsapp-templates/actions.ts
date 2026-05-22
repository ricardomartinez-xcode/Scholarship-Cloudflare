"use server";

import { AdminCapability, WhatsappTemplateKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import {
  reviewWhatsappTemplateAsAdmin,
  upsertOfficialWhatsappTemplateAsAdmin,
} from "@/lib/whatsapp-templates";

export async function reviewWhatsappTemplateAction(formData: FormData) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  const admin = await requireAdminCapabilityUser(AdminCapability.manage_ctas);

  const templateId = String(formData.get("templateId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim();

  if (!templateId) {
    return;
  }

  if (decision !== "approve" && decision !== "reject" && decision !== "publish") {
    return;
  }

  try {
    await reviewWhatsappTemplateAsAdmin({
      templateId,
      decision,
      adminUserId: admin.id,
      adminEmail: admin.email,
      reviewNotes,
    });

    revalidatePath("/admin/whatsapp-templates");
    revalidatePath("/unidep");
  } catch {
    return;
  }
}

export async function saveOfficialWhatsappTemplateAction(formData: FormData) {
  await requireAdminCapabilityUser(AdminCapability.view_admin_operations);
  const admin = await requireAdminCapabilityUser(AdminCapability.manage_ctas);

  const templateId = String(formData.get("templateId") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const kindValue = String(formData.get("kind") ?? "").trim().toLowerCase();
  const baseText = String(formData.get("baseText") ?? "") || null;
  const setAsDefault = String(formData.get("setAsDefault") ?? "").trim() === "true";

  const kind =
    kindValue === WhatsappTemplateKind.summary
      ? WhatsappTemplateKind.summary
      : WhatsappTemplateKind.detailed;

  try {
    await upsertOfficialWhatsappTemplateAsAdmin({
      templateId,
      adminUserId: admin.id,
      adminEmail: admin.email,
      name,
      kind,
      baseText,
      setAsDefault,
    });
  } catch {
    redirect(
      `/admin/whatsapp-templates${templateId ? `?edit=${templateId}` : "?create=1"}&error=save`,
    );
  }

  revalidatePath("/admin/whatsapp-templates");
  revalidatePath("/unidep");
  redirect("/admin/whatsapp-templates?saved=1");
}
