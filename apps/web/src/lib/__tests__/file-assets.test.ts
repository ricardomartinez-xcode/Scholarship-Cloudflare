import { describe, expect, it } from "vitest";

import {
  buildFileAssetLinks,
  fileAssetToContentBucketObject,
  normalizeFileAssetUsageKey,
  resolveEnrollmentFormatR2AssetPayload,
  resolveProgramR2AssetPayload,
} from "@/lib/file-assets";

describe("file asset helpers", () => {
  it("normaliza targetType y slot sin alterar targetId", () => {
    expect(
      normalizeFileAssetUsageKey({
        targetType: " Program ",
        targetId: "Program-ID-ABC",
        slot: "Study Plan PDF",
      }),
    ).toEqual({
      targetType: "program",
      targetId: "Program-ID-ABC",
      slot: "study_plan_pdf",
    });
  });

  it("construye links autenticados relativos para preview y descarga", () => {
    expect(buildFileAssetLinks("11111111-1111-1111-1111-111111111111")).toEqual({
      previewUrl: "/api/files/11111111-1111-1111-1111-111111111111/auth-view",
      downloadUrl: "/api/files/11111111-1111-1111-1111-111111111111/download",
    });
  });

  it("convierte un file_asset sincronizado en fallback de lectura tipo bucket", () => {
    expect(
      fileAssetToContentBucketObject({
        id: "file-1",
        r2Key: "Maestría/Administracion financiera.pdf",
        fileName: "Administracion financiera.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1234,
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).toEqual({
      key: "Maestría/Administracion financiera.pdf",
      fileName: "Administracion financiera.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      lastModified: "2026-06-01T00:00:00.000Z",
      previewUrl: "/api/files/file-1/auth-view",
      downloadUrl: "/api/files/file-1/download",
    });
  });

  it("prefiere assets R2 sobre URLs legacy para programas", () => {
    const payload = resolveProgramR2AssetPayload({
      programId: "program-1",
      planPdfUrl: "https://legacy.example/plan.pdf",
      brochurePdfUrl: "https://legacy.example/brochure.pdf",
      assets: {
        study_plan_pdf: {
          fileId: "plan-file",
          fileName: "plan.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234,
        },
        brochure_pdf: null,
        hero_image: {
          fileId: "image-file",
          fileName: "hero.png",
          mimeType: "image/png",
          sizeBytes: 4321,
        },
      },
    });

    expect(payload.planPdfUrl).toBe("/api/files/plan-file/auth-view");
    expect(payload.planDownloadUrl).toBe("/api/files/plan-file/download");
    expect(payload.brochurePdfUrl).toBe("https://legacy.example/brochure.pdf");
    expect(payload.brochureDownloadUrl).toBe("https://legacy.example/brochure.pdf");
    expect(payload.heroImageUrl).toBe("/api/files/image-file/auth-view");
    expect(payload.r2Assets.studyPlan?.fileName).toBe("plan.pdf");
    expect(payload.r2Assets.brochure).toBeNull();
    expect(payload.r2Assets.heroImage?.downloadUrl).toBe("/api/files/image-file/download");
  });

  it("prefiere assets R2 sobre URLs legacy para formatos", () => {
    const payload = resolveEnrollmentFormatR2AssetPayload({
      fileName: "Formato legacy.pdf",
      fileUrl: "https://legacy.example/formato.pdf",
      fileMimeType: "application/pdf",
      fileSizeBytes: 321,
      sourceType: "upload",
      asset: {
        fileId: "format-file",
        fileName: "Formato R2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1234,
      },
    });

    expect(payload.fileName).toBe("Formato R2.pdf");
    expect(payload.fileUrl).toBe("/api/files/format-file/auth-view");
    expect(payload.fileDownloadUrl).toBe("/api/files/format-file/download");
    expect(payload.fileMimeType).toBe("application/pdf");
    expect(payload.fileSizeBytes).toBe(1234);
    expect(payload.sourceType).toBe("r2");
    expect(payload.r2Asset?.fileName).toBe("Formato R2.pdf");
  });
});
