import { describe, expect, it, vi } from "vitest";

import { createMatriculaSdkClient } from "./client";

describe("matricula SDK client", () => {
  it("shares matricula payloads with auth, idempotency, and credential URL support", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          shareId: "share_123",
          status: "accepted",
          credentialUrl: "https://unidep-id-creator.vercel.app/c/share_123",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createMatriculaSdkClient({
      baseUrl: "https://unidep-id-creator.vercel.app",
      auth: { type: "api-key", apiKey: "secret", headerName: "x-api-key" },
      fetch: fetchMock,
    });

    const response = await client.shareMatricula(
      {
        matricula: "A123",
        source: "scholarship",
        student: { fullName: "Ana Test" },
      },
      { idempotencyKey: "idem-123" },
    );

    expect(response.credentialUrl).toBe("https://unidep-id-creator.vercel.app/c/share_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://unidep-id-creator.vercel.app/api/matricula/share",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": "secret",
          "Idempotency-Key": "idem-123",
        }),
      }),
    );
  });
});
