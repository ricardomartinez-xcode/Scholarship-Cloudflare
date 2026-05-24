import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  returnSubjectPrice: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/campus-resolver", () => ({
  resolveCampus: vi.fn(async () => ({
    id: "campus-1",
    code: "CUU",
    metaKey: "Chihuahua",
    name: "Chihuahua",
    slug: "chihuahua",
    tier: "T2",
    kind: "campus",
  })),
}));

import { syncCanonicalMateriaRow } from "@/lib/return-subject-price-admin";

describe("syncCanonicalMateriaRow", () => {
  beforeEach(() => {
    prismaMock.returnSubjectPrice.findFirst.mockReset();
    prismaMock.returnSubjectPrice.create.mockReset();
    prismaMock.returnSubjectPrice.update.mockReset();
    prismaMock.returnSubjectPrice.deleteMany.mockReset();
    prismaMock.returnSubjectPrice.findMany.mockReset();
  });

  it("writes only canonical return subject price fields", async () => {
    prismaMock.returnSubjectPrice.findFirst.mockResolvedValue(null);
    prismaMock.returnSubjectPrice.create.mockResolvedValue({ id: "row-1" });

    await syncCanonicalMateriaRow({
      plantelRaw: "Chihuahua",
      modalidadRaw: "Presencial",
      materiasCount: 3,
      costo: 4200,
    });

    expect(prismaMock.returnSubjectPrice.create).toHaveBeenCalledWith({
      data: {
        campusId: "campus-1",
        modality: "presencial",
        subjectCount: 3,
        priceMxn: 4200,
        sourceVersion: "canonical",
      },
    });
  });
});
