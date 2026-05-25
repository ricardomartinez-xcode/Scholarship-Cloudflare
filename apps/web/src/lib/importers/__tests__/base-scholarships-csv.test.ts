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
      "region,plantel,tier,ingreso,linea,modalidad,plan,promedio,porcentaje",
      "General,Todos,T1,nuevo_ingreso,licenciatura,presencial,9,8-8.9,20",
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
      "ingreso,linea,modalidad,plan,promedio,porcentaje,tier",
      "nuevo_ingreso,licenciatura,online,11,9-10,55,T2",
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
