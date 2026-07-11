import type { FileAssetRecord } from "@/lib/file-assets";
import {
  buildContentBucketProxyUrl,
  getSignedContentBucketGetUrl,
} from "@/lib/storage/content-bucket";
import { createSignedStorageDownloadUrl } from "@/lib/storage/supabase-storage";

function isMissingStorageConfig(error: unknown) {
  return error instanceof Error && /configured|required/i.test(error.message);
}

export async function getFileAssetRedirectUrl(
  file: Pick<FileAssetRecord, "r2Key" | "bucket" | "fileName" | "mimeType">,
  disposition: "inline" | "attachment",
) {
  try {
    return await createSignedStorageDownloadUrl({
      bucket: file.bucket,
      key: file.r2Key,
      fileName: file.fileName,
      disposition,
    });
  } catch (error) {
    if (!isMissingStorageConfig(error)) throw error;
  }

  try {
    return await getSignedContentBucketGetUrl({
      key: file.r2Key,
      fileName: file.fileName,
      contentType: file.mimeType,
      disposition,
    });
  } catch (error) {
    if (!isMissingStorageConfig(error)) throw error;
  }

  return buildContentBucketProxyUrl(file.r2Key, { download: disposition === "attachment" });
}
