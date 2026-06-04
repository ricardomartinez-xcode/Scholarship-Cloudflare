import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.hoisted(() => vi.fn());
const authGetSessionMock = vi.hoisted(() => vi.fn());
const getIssuedExtensionSessionUserMock = vi.hoisted(() => vi.fn());
const getExtensionAuthSessionMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  invite: {
    findFirst: vi.fn(),
  },
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: authGetSessionMock,
  },
}));

vi.mock("@/lib/domain", () => ({
  isAllowedEmail: vi.fn(() => true),
}));

vi.mock("@/lib/extension-auth", () => ({
  EXTENSION_SESSION_TOKEN_HEADER: "x-extension-session-token",
  getExtensionAuthSession: getExtensionAuthSessionMock,
}));

vi.mock("@/lib/extension-session-tokens", () => ({
  getIssuedExtensionSessionUser: getIssuedExtensionSessionUserMock,
  isIssuedExtensionToken: (token: string) => token.startsWith("rx_ext_"),
}));

vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("extension client auth", () => {
  beforeEach(() => {
    headersMock.mockReset();
    authGetSessionMock.mockReset();
    getIssuedExtensionSessionUserMock.mockReset();
    getExtensionAuthSessionMock.mockReset();
    prismaMock.invite.findFirst.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    vi.resetModules();
  });

  it("does not fall back to a web cookie when an extension client has no token", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-extension-client": "chrome-sidepanel" }));
    authGetSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "auth-1",
            email: "ricardomartinez@relead.com.mx",
          },
        },
      },
      error: null,
    });

    const { getSessionUser } = await import("@/lib/authz");
    const session = await getSessionUser();

    expect(session).toEqual({ status: "unauthenticated", user: null, email: null });
    expect(authGetSessionMock).not.toHaveBeenCalled();
  });

  it("does not fall back to a web cookie when an extension token is stale", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        authorization: "Bearer rx_ext_token.secret",
        "x-extension-client": "chrome-sidepanel",
      }),
    );
    getIssuedExtensionSessionUserMock.mockResolvedValue(null);
    authGetSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "auth-1",
            email: "ricardomartinez@relead.com.mx",
          },
        },
      },
      error: null,
    });

    const { getSessionUser } = await import("@/lib/authz");
    const session = await getSessionUser();

    expect(session).toEqual({ status: "unauthenticated", user: null, email: null });
    expect(authGetSessionMock).not.toHaveBeenCalled();
  });

  it("accepts an active issued extension token for extension clients", async () => {
    const user = {
      id: "00000000-0000-0000-0000-000000000001",
      authUserId: "auth-1",
      email: "ricardomartinez@relead.com.mx",
      role: Role.user,
      isActive: true,
      lastLoginAt: new Date("2026-06-04T00:00:00.000Z"),
    };
    headersMock.mockResolvedValue(
      new Headers({
        authorization: "Bearer rx_ext_token.secret",
        "x-extension-client": "chrome-sidepanel",
      }),
    );
    getIssuedExtensionSessionUserMock.mockResolvedValue(user);

    const { getSessionUser } = await import("@/lib/authz");
    const session = await getSessionUser();

    expect(session).toMatchObject({
      status: "ok",
      email: "ricardomartinez@relead.com.mx",
      user,
    });
    expect(authGetSessionMock).not.toHaveBeenCalled();
  });
});
