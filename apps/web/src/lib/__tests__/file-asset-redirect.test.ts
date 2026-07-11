import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/supabase-storage", () => ({
  createSignedStorageDownloadUrl: vi.fn(async () => {
    throw new Error("Supabase Storage is not configured.");
  }),
}));

vi.mock("@/lib/storage/content-bucket", () => ({
  buildContentBucketProxyUrl: (key: string, options?: { download?: boolean }) =>
    `/api/content-bucket/${key}${options?.download ? "?download=1" : ""}`,
  getSignedContentBucketGetUrl: vi.fn(async () => {
    throw new Error("Supabase content bucket is not configured.");
  }),
}));

import { getFileAssetRedirectUrl } from "@/lib/file-asset-redirect";

describe("file asset redirects", () => {
  it("falls back to the content bucket public URL when signing env vars are missing", async () => {
    const file = {
      r2Key: "Maestría/Administracion financiera.pdf",
      bucket: "documents",
      fileName: "Administracion financiera.pdf",
      mimeType: "application/pdf",
    };

    await expect(getFileAssetRedirectUrl(file, "inline")).resolves.toBe(
      "/api/content-bucket/Maestría/Administracion financiera.pdf",
    );
    await expect(getFileAssetRedirectUrl(file, "attachment")).resolves.toBe(
      "/api/content-bucket/Maestría/Administracion financiera.pdf?download=1",
    );
  });
});
