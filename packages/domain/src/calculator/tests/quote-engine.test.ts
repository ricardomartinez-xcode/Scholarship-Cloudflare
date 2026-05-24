import { describe, expect, it } from "vitest";

import { runQuoteEngine } from "@relead/domain/calculator/quote-engine";

describe("calculator quote engine", () => {
  it("calcula caso con beca", () => {
    const result = runQuoteEngine({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "online",
      plan: 3,
      average: 9.1,
      basePriceMxn: 2000,
      scholarshipPercent: 40,
      additionalBenefitPercent: 5,
    });
    expect(result.scholarshipAmountMxn).toBe(800);
    expect(result.totalMxn).toBe(1100);
  });

  it("calcula caso sin beca por promedio", () => {
    const result = runQuoteEngine({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "presencial",
      campus: "Hermosillo",
      plan: 3,
      average: 6.9,
      basePriceMxn: 2000,
      scholarshipPercent: 40,
    });
    expect(result.sinAccessToScholarship).toBe(true);
    expect(result.scholarshipPercent).toBe(0);
    expect(result.totalMxn).toBe(2000);
  });

  it("usa el porcentaje configurado por tipo de ingreso sin topes legacy", () => {
    const reingreso = runQuoteEngine({
      enrollmentType: "reingreso",
      businessLine: "maestria",
      modality: "mixta",
      campus: "Monterrey",
      plan: 1,
      average: 9.5,
      basePriceMxn: 1000,
      scholarshipPercent: 50,
    });
    expect(reingreso.scholarshipPercent).toBe(50);

    const regreso = runQuoteEngine({
      enrollmentType: "regreso",
      businessLine: "licenciatura",
      modality: "presencial",
      campus: "Chihuahua",
      plan: 2,
      average: 9.5,
      basePriceMxn: 1000,
      scholarshipPercent: 40,
    });
    expect(regreso.scholarshipPercent).toBe(40);
  });

  it("soporta planteles/modalidades distintas", () => {
    const campusA = runQuoteEngine({
      enrollmentType: "nuevo_ingreso",
      businessLine: "prepa",
      modality: "presencial",
      campus: "Mexicali",
      plan: 1,
      average: 8,
      basePriceMxn: 1500,
      scholarshipPercent: 20,
    });
    const campusB = runQuoteEngine({
      enrollmentType: "nuevo_ingreso",
      businessLine: "prepa",
      modality: "online",
      campus: "ONLINE",
      plan: 1,
      average: 8,
      basePriceMxn: 1800,
      scholarshipPercent: 20,
    });
    expect(campusA.totalMxn).not.toBe(campusB.totalMxn);
  });
});
