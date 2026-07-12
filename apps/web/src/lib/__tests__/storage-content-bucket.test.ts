import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/storage/supabase-storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/supabase-storage")>(
    "@/lib/storage/supabase-storage",
  );
  return {
    ...actual,
    createSignedStorageDownloadUrl: vi.fn(async () => "https://supabase.test/signed-url"),
    listStorageObjects: vi.fn(async () => [
      {
        key: "Maestría/Administracion financiera.pdf",
        fileName: "Administracion financiera.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        lastModified: null,
      },
    ]),
  };
});

import {
  buildContentBucketProxyUrl,
  buildContentBucketPublicUrl,
  findContentBucketPlanForProgram,
  getSignedContentBucketGetUrl,
  listContentBucketObjects,
} from "@/lib/storage/content-bucket";

describe("Supabase Storage content bucket helpers", () => {
  it("builds same-origin proxy URLs for inline and download previews", () => {
    expect(buildContentBucketPublicUrl("Maestría/Administracion financiera.pdf")).toBe(
      "/api/content-bucket/Maestr%C3%ADa/Administracion%20financiera.pdf",
    );
    expect(
      buildContentBucketProxyUrl("Maestría/Administracion financiera.pdf", {
        download: true,
      }),
    ).toBe(
      "/api/content-bucket/Maestr%C3%ADa/Administracion%20financiera.pdf?download=1",
    );
  });

  it("delegates signed URLs to Supabase Storage", async () => {
    await expect(
      getSignedContentBucketGetUrl({
        key: "Ingenieria/plan.pdf",
        disposition: "inline",
        contentType: "application/pdf",
      }),
    ).resolves.toBe("https://supabase.test/signed-url");
  });

  it("matches program names to PDFs in the content bucket without requiring explicit usage rows", () => {
    const match = findContentBucketPlanForProgram("Maestría en Administración Financiera", [
      {
        key: "Maestría/Administracion de Negocios y Mercadotecnia.pdf",
        fileName: "Administracion de Negocios y Mercadotecnia.pdf",
        mimeType: "application/pdf",
        sizeBytes: 999,
        lastModified: null,
        previewUrl: "/api/content-bucket/negocios.pdf",
        downloadUrl: "/api/content-bucket/negocios.pdf?download=1",
      },
      {
        key: "Maestría/Administracion financiera.pdf",
        fileName: "Administracion financiera.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        lastModified: null,
        previewUrl: "/api/content-bucket/financiera.pdf",
        downloadUrl: "/api/content-bucket/financiera.pdf?download=1",
      },
    ]);

    expect(match?.key).toBe("Maestría/Administracion financiera.pdf");
  });

  it("maps listed storage objects to content bucket payloads", async () => {
    await expect(listContentBucketObjects()).resolves.toEqual([
      {
        key: "Maestría/Administracion financiera.pdf",
        fileName: "Administracion financiera.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        lastModified: null,
        previewUrl: "/api/content-bucket/Maestr%C3%ADa/Administracion%20financiera.pdf",
        downloadUrl:
          "/api/content-bucket/Maestr%C3%ADa/Administracion%20financiera.pdf?download=1",
      },
    ]);
  });
});
