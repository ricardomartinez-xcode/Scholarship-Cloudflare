import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedR2GetUrl: vi.fn(() => {
    throw new Error("R2 storage is not configured.");
  }),
}));

vi.mock("@/lib/r2-content-bucket", () => ({
  buildContentBucketProxyUrl: (key: string, options?: { download?: boolean }) =>
    `/api/content-bucket/${key}${options?.download ? "?download=1" : ""}`,
  getSignedContentBucketGetUrl: vi.fn(() => {
    throw new Error("R2 content bucket is not configured.");
  }),
}));

import { getFileAssetRedirectUrl } from "@/lib/file-asset-redirect";

describe("file asset redirects", () => {
  it("falls back to the content bucket public URL when signing env vars are missing", () => {
    const file = {
      r2Key: "Maestría/Administracion financiera.pdf",
      fileName: "Administracion financiera.pdf",
      mimeType: "application/pdf",
    };

    expect(getFileAssetRedirectUrl(file, "inline")).toBe(
      "/api/content-bucket/Maestría/Administracion financiera.pdf",
    );
    expect(getFileAssetRedirectUrl(file, "attachment")).toBe(
      "/api/content-bucket/Maestría/Administracion financiera.pdf?download=1",
    );
  });
});
