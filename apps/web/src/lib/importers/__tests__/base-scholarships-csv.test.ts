import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  scholarshipRule: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { prepareBaseScholarshipsCsvImport } from "@/lib/importers/base-scholarships-csv";

describe("prepareBaseScholarshipsCsvImport", () => {
  beforeEach(() => {
    prismaMock.scholarshipRule.findMany.mockReset();
    prismaMock.scholarshipRule.findMany.mockResolvedValue([]);
  });

  it("imports canonical base scholarship rows separately from additional benefits", async () => {
    const csv = [
      "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "licenciatura,General,Todos,T1,20,nuevo_ingreso,presencial,9,8-8.9",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-promedio.csv", { type: "text/csv" }),
    });

    expect(result.summary).toMatchObject({
      processed: 1,
      ready: 1,
      created: 1,
      updated: 0,
      unchanged: 0,
      errors: [],
    });
    expect(result.payload.rows[0]).toMatchObject({
      region: "General",
      plantel: "Todos",
      tier: "T1",
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "presencial",
      plan: 9,
      minAverage: 8,
      maxAverage: 8.9,
      scholarshipPercent: 20,
    });
  });

  it("uses ANY tier for online rows because Online is a campus exception", async () => {
    const csv = [
      "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "licenciatura,Online,Online,T2,55,nuevo_ingreso,online,11,9-10",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-online.csv", { type: "text/csv" }),
    });

    expect(result.summary.errors).toEqual([]);
    expect(result.summary.warnings).toContain(
      "Fila 2: tier se ignoró porque modalidad=online.",
    );
    expect(result.payload.rows[0]).toMatchObject({
      modality: "online",
      tier: "ANY",
    });
  });
});
