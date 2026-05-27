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
      region: null,
      plantel: null,
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

  it("normalizes visible enrollment labels to canonical values", async () => {
    const csv = [
      "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "licenciatura,General,Todos,T1,20,Nuevo Ingreso,presencial,9,8-8.9",
      "licenciatura,General,Todos,T1,25,NI,presencial,10,8-8.9",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-ingreso.csv", { type: "text/csv" }),
    });

    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows.map((row) => row.enrollmentType)).toEqual([
      "nuevo_ingreso",
      "nuevo_ingreso",
    ]);
  });

  it("normalizes visible business line labels to canonical values", async () => {
    const csv = [
      "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "Licenciatura Online,Online,Online,,55,Reingreso,Online,11,9-10",
      "Bachillerato Escolarizado,CDMX,Plantel Norte,T2,20,Regreso,Presencial,6,8-8.9",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-linea.csv", { type: "text/csv" }),
    });

    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows[0]).toMatchObject({
      businessLine: "licenciatura",
      enrollmentType: "reingreso",
      modality: "online",
      tier: "ANY",
    });
    expect(result.payload.rows[1]).toMatchObject({
      businessLine: "prepa",
      enrollmentType: "regreso",
      modality: "presencial",
      tier: "T2",
    });
  });

  it("normalizes visible modality labels to canonical values", async () => {
    const csv = [
      "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "licenciatura,General,Todos,T1,20,nuevo_ingreso,Escolarizada,9,8-8.9",
      "licenciatura,General,Todos,T2,25,nuevo_ingreso,Ejecutiva,9,8-8.9",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-modalidad.csv", { type: "text/csv" }),
    });

    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows.map((row) => row.modality)).toEqual([
      "presencial",
      "mixta",
    ]);
  });



  it("accepts programa/carrera to scope a base scholarship to one program", async () => {
    const csv = [
      "linea,region,plantel,programa,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "salud,Sonora,Hermosillo,Psicología,T3,25,nuevo_ingreso,presencial,9,9-10",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-psicologia.csv", { type: "text/csv" }),
    });

    expect(result.summary.errors).toEqual([]);
    expect(result.payload.rows[0]).toMatchObject({
      businessLine: "salud",
      plantel: "Hermosillo",
      programaKey: "psicologia",
      tier: "T3",
      plan: 9,
      scholarshipPercent: 25,
    });
  });
  it("keeps a clear error when a value is not recognizable", async () => {
    const csv = [
      "linea,region,plantel,tier,porcentaje,ingreso,modalidad,plan,promedio",
      "licenciatura,General,Todos,T1,20,Transferencia,presencial,9,8-8.9",
    ].join("\n");

    const result = await prepareBaseScholarshipsCsvImport({
      file: new File([csv], "beca-error.csv", { type: "text/csv" }),
    });

    expect(result.summary.errors).toContain('Fila 2: ingreso inválido "Transferencia".');
    expect(result.payload.rows).toEqual([]);
  });
});
