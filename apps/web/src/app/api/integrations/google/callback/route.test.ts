import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  parseGoogleCallbackStateMock,
  upsertGoogleConnectionFromCodeMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  parseGoogleCallbackStateMock: vi.fn(),
  upsertGoogleConnectionFromCodeMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/google-integration", () => ({
  parseGoogleCallbackState: parseGoogleCallbackStateMock,
  upsertGoogleConnectionFromCode: upsertGoogleConnectionFromCodeMock,
}));

import { GET } from "./route";

function buildRequest(state = "state", code = "code") {
  return new Request(
    `https://recalc.relead.com.mx/api/integrations/google/callback?state=${state}&code=${code}`,
  );
}

describe("GET /api/integrations/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseGoogleCallbackStateMock.mockReturnValue({
      userId: "user-1",
      nextPath: "/unidep/contactos",
      intent: "contacts_sync",
      service: "contacts",
      signed: true,
      validSignature: true,
      expired: false,
    });
    upsertGoogleConnectionFromCodeMock.mockResolvedValue({ ok: true });
  });

  it("acepta callback sin cookie cuando el state viene firmado y vigente", async () => {
    getSessionUserMock.mockResolvedValue({ status: "unauthenticated" });

    const response = await GET(buildRequest());

    expect(upsertGoogleConnectionFromCodeMock).toHaveBeenCalledWith({
      userId: "user-1",
      code: "code",
    });
    expect(response.headers.get("location")).toContain(
      "/unidep/contactos?googleSync=connected&googleSyncIntent=contacts_sync",
    );
  });

  it("rechaza callback sin cookie cuando el state no está firmado", async () => {
    getSessionUserMock.mockResolvedValue({ status: "unauthenticated" });
    parseGoogleCallbackStateMock.mockReturnValue({
      userId: "user-1",
      nextPath: "/unidep/contactos",
      intent: "contacts_sync",
      service: "contacts",
      signed: false,
      validSignature: false,
      expired: false,
    });

    const response = await GET(buildRequest());

    expect(upsertGoogleConnectionFromCodeMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain(
      "/unidep/contactos?googleSync=session-expired&googleSyncIntent=contacts_sync",
    );
  });

  it("mantiene validación de mismatch cuando sí hay sesión", async () => {
    getSessionUserMock.mockResolvedValue({
      status: "ok",
      user: { id: "user-2" },
    });

    const response = await GET(buildRequest());

    expect(upsertGoogleConnectionFromCodeMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/profile?googleSync=state-mismatch");
  });
});
