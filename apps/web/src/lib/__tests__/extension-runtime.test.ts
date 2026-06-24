import { beforeEach, describe, expect, it, vi } from "vitest";

const { getExtensionPanelConfigMock, getQuoteModeMock, prismaMock } = vi.hoisted(() => ({
  getExtensionPanelConfigMock: vi.fn(),
  getQuoteModeMock: vi.fn(),
  prismaMock: {
    adminPriceOverride: { findMany: vi.fn() },
    campus: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/extension-panel-config", () => ({
  getExtensionPanelConfig: getExtensionPanelConfigMock,
}));

vi.mock("@/lib/runtime-modes", () => ({
  getQuoteMode: getQuoteModeMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { buildExtensionBootstrap } from "@/lib/extension-runtime";

describe("buildExtensionBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getExtensionPanelConfigMock.mockResolvedValue({
      selectorPack: { version: "test-selector-pack" },
    });
    getQuoteModeMock.mockReturnValue("canonical");
    prismaMock.adminPriceOverride.findMany.mockResolvedValue([
      {
        id: "price_lic_online",
        scope: "base_price",
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "online",
          plan: "9",
          subject_price_mxn: "850",
        },
        newPrice: 5600,
        isActive: true,
        notes: null,
        updatedBy: null,
      },
    ]);
    prismaMock.campus.findMany.mockResolvedValue([
      {
        id: "campus_1",
        code: "MXL",
        metaKey: "MEXICALI",
        name: "Mexicali",
        slug: "mexicali",
      },
    ]);
  });

  it("includes lightweight quote selector data for the extension sidepanel", async () => {
    const payload = await buildExtensionBootstrap({
      user: {
        id: "user_1",
        email: "user@example.com",
        role: "owner",
      },
    });

    expect(payload.quoteRuntime).toEqual({
      combinations: [
        {
          enrollmentType: "nuevo_ingreso",
          businessLine: "licenciatura",
          modality: "online",
          plan: 9,
          module: "Longitudinal",
        },
        {
          enrollmentType: "regreso",
          businessLine: "licenciatura",
          modality: "online",
          plan: 9,
          module: "Longitudinal",
        },
        {
          enrollmentType: "reingreso",
          businessLine: "licenciatura",
          modality: "online",
          plan: 9,
          module: "Longitudinal",
        },
      ],
      campuses: [{ value: "MEXICALI", label: "Mexicali" }],
      subjectCounts: [1, 2, 3, 4, 5, 6, 7],
    });
    expect(prismaMock.adminPriceOverride.findMany).toHaveBeenCalledWith({
      where: { scope: "base_price", isActive: true },
      select: {
        id: true,
        scope: true,
        targetKeys: true,
        newPrice: true,
        isActive: true,
        notes: true,
        updatedBy: true,
      },
    });
    expect(prismaMock.campus.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, code: true, metaKey: true, name: true, slug: true },
    });
  });
});
