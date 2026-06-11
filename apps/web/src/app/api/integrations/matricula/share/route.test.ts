import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.fn();
const shareMatriculaFromScholarshipMock = vi.fn();
const syncMatriculaContactToGoogleSheetMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/integrations/matricula", () => ({
  isMatriculaSharingEnabled: vi.fn(() => true),
  shareMatriculaFromScholarship: shareMatriculaFromScholarshipMock,
}));

vi.mock("@/lib/google-integration", () => ({
  syncMatriculaContactToGoogleSheet: syncMatriculaContactToGoogleSheetMock,
}));

async function post(payload: Record<string, unknown>) {
  const { POST } = await import("./route");
  return POST(
    new Request("https://recalc.local/api/integrations/matricula/share", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

describe("matricula share route", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionUserMock.mockReset();
    shareMatriculaFromScholarshipMock.mockReset();
    syncMatriculaContactToGoogleSheetMock.mockReset();
    shareMatriculaFromScholarshipMock.mockResolvedValue({
      ok: true,
      shareId: "share_123",
      credentialUrl: "https://credential.test/share_123",
    });
  });

  it("syncs Google Sheets before creating the matricula card for connected users", async () => {
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
      email: "owner@test.com",
    });
    syncMatriculaContactToGoogleSheetMock.mockResolvedValue({
      ok: true,
      action: "updated",
      spreadsheetId: "sheet_123",
      matchedBy: "email",
    });

    const response = await post({
      matricula: "A123",
      student: {
        fullName: "Ana Perez",
        email: "ana@correo.com",
        phone: "6621112233",
      },
      academic: {
        campus: "Hermosillo",
        region: "Noroeste",
        modality: "Presencial",
        program: "Licenciatura",
        module: "M1",
      },
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(syncMatriculaContactToGoogleSheetMock).toHaveBeenCalledBefore(
      shareMatriculaFromScholarshipMock,
    );
    expect(syncMatriculaContactToGoogleSheetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        contact: expect.objectContaining({
          matricula: "A123",
          fullName: "Ana Perez",
          email: "ana@correo.com",
          campus: "Hermosillo",
          region: "Noroeste",
          module: "M1",
        }),
      }),
    );
    expect(payload.sheetSync).toEqual(
      expect.objectContaining({ ok: true, action: "updated", matchedBy: "email" }),
    );
    expect(payload.shareId).toBe("share_123");
  });

  it("does not create the matricula card when connected Sheets sync fails", async () => {
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user_1" },
      email: "owner@test.com",
    });
    syncMatriculaContactToGoogleSheetMock.mockRejectedValue(new Error("Sheets failed"));

    const response = await post({ matricula: "A123" });
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("Sheets failed");
    expect(shareMatriculaFromScholarshipMock).not.toHaveBeenCalled();
  });

  it("creates the matricula card without Sheets when the request has no authenticated user", async () => {
    getSessionUserMock.mockResolvedValue({
      status: "unauthenticated",
      user: null,
      email: null,
    });

    const response = await post({ matricula: "A123" });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(syncMatriculaContactToGoogleSheetMock).not.toHaveBeenCalled();
    expect(shareMatriculaFromScholarshipMock).toHaveBeenCalled();
    expect(payload.sheetSync).toEqual({ ok: false, skipped: "unauthenticated" });
  });
});
