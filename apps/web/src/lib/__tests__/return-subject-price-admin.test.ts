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
const resolveCampusMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/campus-resolver", () => ({
  resolveCampus: resolveCampusMock,
}));

import {
  deleteCanonicalMateriaRow,
  syncCanonicalMateriaRow,
} from "@/lib/return-subject-price-admin";

describe("syncCanonicalMateriaRow", () => {
  beforeEach(() => {
    prismaMock.returnSubjectPrice.findFirst.mockReset();
    prismaMock.returnSubjectPrice.create.mockReset();
    prismaMock.returnSubjectPrice.update.mockReset();
    prismaMock.returnSubjectPrice.deleteMany.mockReset();
    prismaMock.returnSubjectPrice.findMany.mockReset();
    resolveCampusMock.mockReset();
    resolveCampusMock.mockResolvedValue({
      id: "campus-1",
      code: "CUU",
      metaKey: "Chihuahua",
      name: "Chihuahua",
      slug: "chihuahua",
      tier: "T2",
      kind: "campus",
    });
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

  it("updates the canonical materia row selected by the original key", async () => {
    prismaMock.returnSubjectPrice.findFirst.mockResolvedValue({ id: "row-1" });
    prismaMock.returnSubjectPrice.update.mockResolvedValue({ id: "row-1" });

    const result = await syncCanonicalMateriaRow({
      plantelRaw: "Chihuahua",
      modalidadRaw: "Online",
      materiasCount: 4,
      costo: 5100,
      origPlantel: "Chihuahua",
      origModalidad: "Presencial",
      origMaterias: 3,
    });

    expect(result).toEqual({ ok: true, reason: "updated" });
    expect(prismaMock.returnSubjectPrice.findFirst).toHaveBeenCalledWith({
      where: {
        campusId: "campus-1",
        modality: "presencial",
        subjectCount: 3,
        sourceVersion: "canonical",
      },
      select: { id: true },
    });
    expect(prismaMock.returnSubjectPrice.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: {
        campusId: "campus-1",
        modality: "online",
        subjectCount: 4,
        priceMxn: 5100,
      },
    });
  });

  it("deletes canonical materia rows by campus, modality, subject count, and source version", async () => {
    prismaMock.returnSubjectPrice.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteCanonicalMateriaRow({
      plantelRaw: "Chihuahua",
      modalidadRaw: "Online",
      materiasCount: 6,
    });

    expect(result).toEqual({ ok: true, reason: "deleted" });
    expect(prismaMock.returnSubjectPrice.deleteMany).toHaveBeenCalledWith({
      where: {
        campusId: "campus-1",
        modality: "online",
        subjectCount: 6,
        sourceVersion: "canonical",
      },
    });
  });
});
