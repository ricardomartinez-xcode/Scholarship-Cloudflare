export type FileAssetSlot =
  | "study_plan_pdf"
  | "brochure_pdf"
  | "hero_image"
  | "thumbnail_image"
  | "training_material"
  | "training_video"
  | "training_pdf"
  | "training_image"
  | "training_file"
  | "format_document"
  | "cta_modal_image";

export type FileAssetRecord = {
  id: string;
  r2Key: string;
  bucket: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  etag: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export function buildFileAssetLinks(fileId: string) {
  return {
    previewUrl: `/api/files/${encodeURIComponent(fileId)}/auth-view`,
    downloadUrl: `/api/files/${encodeURIComponent(fileId)}/download`,
  };
}
