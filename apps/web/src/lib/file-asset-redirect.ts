import type { FileAssetRecord } from "@/lib/file-assets";
import {
  buildContentBucketProxyUrl,
  getSignedContentBucketGetUrl,
} from "@/lib/r2-content-bucket";
import { getSignedR2GetUrl } from "@/lib/r2-storage";

function isMissingR2Config(error: unknown) {
  return error instanceof Error && /configured/i.test(error.message);
}

export function getFileAssetRedirectUrl(
  file: Pick<FileAssetRecord, "r2Key" | "fileName" | "mimeType">,
  disposition: "inline" | "attachment",
) {
  try {
    return getSignedR2GetUrl({
      key: file.r2Key,
      fileName: file.fileName,
      contentType: file.mimeType,
      disposition,
    });
  } catch (error) {
    if (!isMissingR2Config(error)) throw error;
  }

  try {
    return getSignedContentBucketGetUrl({
      key: file.r2Key,
      fileName: file.fileName,
      contentType: file.mimeType,
      disposition,
    });
  } catch (error) {
    if (!isMissingR2Config(error)) throw error;
  }

  return buildContentBucketProxyUrl(file.r2Key, { download: disposition === "attachment" });
}
