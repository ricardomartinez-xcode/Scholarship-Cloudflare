"use server";

import { AdminCapability } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminCapabilityUser } from "@/lib/admin-session";
import { syncListedR2ObjectsToFileAssets } from "@/lib/file-assets";
import { getContentBucketName, listContentBucketObjects } from "@/lib/r2-content-bucket";

function redirectWithStatus(message: string) {
  redirect(`/admin/files?status=${encodeURIComponent(message)}`);
}

function redirectWithError(message: string) {
  redirect(`/admin/files?error=${encodeURIComponent(message)}`);
}

export async function syncContentBucketFilesAction() {
  const admin = await requireAdminCapabilityUser(AdminCapability.manage_offers);

  const contentBucketFiles = await listContentBucketObjects();
  if (!contentBucketFiles.length) {
    redirectWithError("No se encontraron archivos listables en el bucket content.");
  }

  const result = await syncListedR2ObjectsToFileAssets({
    bucket: getContentBucketName(),
    files: contentBucketFiles,
    ownerUserId: admin.id,
  });

  revalidatePath("/admin/files");
  redirectWithStatus(
    `Sincronizados ${result.scanned} archivo(s): ${result.created} nuevo(s), ${result.updated} actualizado(s).`,
  );
}
