import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildContentBucketPublicUrl,
  getSignedContentBucketGetUrl,
  listContentBucketObjects,
} from "@/lib/r2-content-bucket";

const ENV_KEYS = [
  "R2_CONTENT_BUCKET",
  "R2_CONTENT_ENDPOINT",
  "R2_CONTENT_PUBLIC_BASE_URL",
  "R2_CONTENT_ACCESS_KEY_ID",
  "R2_CONTENT_SECRET_ACCESS_KEY",
  "R2_CONTENT_REGION",
  "S3_API",
  "Access_Key_ID",
  "Secret_Access_Key",
  "Public_Development_URL",
] as const;

const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function configureBucketAliases() {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.S3_API = "https://example-account.r2.cloudflarestorage.com";
  process.env.Access_Key_ID = "test-access-key";
  process.env.Secret_Access_Key = "test-secret-key";
  process.env.Public_Development_URL = "https://public-bucket.r2.dev";
}

afterEach(() => {
  vi.restoreAllMocks();
  restoreEnv();
});

describe("R2 content bucket helpers", () => {
  it("reads Bucket.txt-style aliases for public and signed content URLs", () => {
    configureBucketAliases();

    expect(buildContentBucketPublicUrl("Ingenieria/plan.pdf")).toBe(
      "https://public-bucket.r2.dev/Ingenieria/plan.pdf",
    );

    const signedUrl = getSignedContentBucketGetUrl({
      key: "Ingenieria/plan.pdf",
      disposition: "inline",
      contentType: "application/pdf",
    });

    expect(signedUrl).toContain(
      "https://example-account.r2.cloudflarestorage.com/planes-de-estudio/Ingenieria/plan.pdf?",
    );
    expect(signedUrl).toContain("X-Amz-Signature=");
  });

  it("signs ListObjectsV2 with AWS byte-order query sorting before falling back to manifests", async () => {
    configureBucketAliases();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const queryKeys = url
        .split("?")[1]
        ?.split("&")
        .map((pair) => decodeURIComponent(pair.split("=")[0] ?? ""))
        .filter((key) => key !== "X-Amz-Signature");

      expect(queryKeys?.slice(0, 5)).toEqual([
        "X-Amz-Algorithm",
        "X-Amz-Credential",
        "X-Amz-Date",
        "X-Amz-Expires",
        "X-Amz-SignedHeaders",
      ]);
      expect(queryKeys).toContain("list-type");
      expect(queryKeys).toContain("max-keys");

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <ListBucketResult>
          <Contents>
            <Key>Ingenieria/Ing Industrial y administracion.pdf</Key>
            <LastModified>2026-05-31T18:00:00.000Z</LastModified>
            <Size>12345</Size>
          </Contents>
        </ListBucketResult>`,
        { status: 200, headers: { "Content-Type": "application/xml" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const objects = await listContentBucketObjects();

    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      key: "Ingenieria/Ing Industrial y administracion.pdf",
      fileName: "Ing Industrial y administracion.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12345,
      previewUrl:
        "https://public-bucket.r2.dev/Ingenieria/Ing%20Industrial%20y%20administracion.pdf",
    });
  });
});
