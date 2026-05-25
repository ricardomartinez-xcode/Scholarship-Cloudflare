import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BASE_SCHOLARSHIP_AVERAGE_RANGES,
  findBaseScholarshipAverageRange,
  resolveBaseScholarshipAverageRange,
  serializeBaseScholarshipRows,
} from "@/lib/admin-base-scholarships";

describe("serializeBaseScholarshipRows", () => {
  it("groups canonical scholarship rules for the admin benefits view", () => {
    const rows = serializeBaseScholarshipRows([
      {
        id: "rule_1",
        enrollmentType: "nuevo_ingreso",
        businessLine: "salud",
        modality: "presencial",
        plan: 12,
        campusTier: "T1",
        minAverage: 8,
        maxAverage: 8.9,
        scholarshipPercent: 15,
        discountedPriceMxn: 2945.25,
        origin: "import",
      },
      {
        id: "rule_2",
        enrollmentType: "nuevo_ingreso",
        businessLine: "salud",
        modality: "presencial",
        plan: 12,
        campusTier: "T1",
        minAverage: 9,
        maxAverage: 10,
        scholarshipPercent: 25,
        discountedPriceMxn: 2598.75,
        origin: "import",
      },
      {
        id: "rule_3",
        enrollmentType: "reingreso",
        businessLine: "salud",
        modality: "presencial",
        plan: 12,
        campusTier: "T1",
        minAverage: null,
        maxAverage: null,
        scholarshipPercent: 20,
        discountedPriceMxn: 2772,
        origin: "import",
      },
    ]);

    expect(rows).toEqual([
      {
        id: "nuevo_ingreso|salud|presencial|12|T1",
        enrollmentType: "nuevo_ingreso",
        businessLine: "salud",
        modality: "presencial",
        plan: 12,
        campusTier: "T1",
        percentages: [15, 25],
        ranges: ["8 - 8.9", "9 - 10"],
        ruleCount: 2,
        rules: [
          {
            id: "rule_1",
            minAverage: 8,
            maxAverage: 8.9,
            scholarshipPercent: 15,
            rangeLabel: "8 - 8.9",
          },
          {
            id: "rule_2",
            minAverage: 9,
            maxAverage: 10,
            scholarshipPercent: 25,
            rangeLabel: "9 - 10",
          },
        ],
      },
      {
        id: "reingreso|salud|presencial|12|T1",
        enrollmentType: "reingreso",
        businessLine: "salud",
        modality: "presencial",
        plan: 12,
        campusTier: "T1",
        percentages: [20],
        ranges: ["Sin rango"],
        ruleCount: 1,
        rules: [
          {
            id: "rule_3",
            minAverage: null,
            maxAverage: null,
            scholarshipPercent: 20,
            rangeLabel: "Sin rango",
          },
        ],
      },
    ]);
  });

  it("exposes the four canonical average ranges used by the benefits form", () => {
    expect(BASE_SCHOLARSHIP_AVERAGE_RANGES).toEqual([
      { value: "6-6.9", label: "6 - 6.9", minAverage: "6", maxAverage: "6.9" },
      { value: "7-7.9", label: "7 - 7.9", minAverage: "7", maxAverage: "7.9" },
      { value: "8-8.9", label: "8 - 8.9", minAverage: "8", maxAverage: "8.9" },
      { value: "9-10", label: "9 - 10", minAverage: "9", maxAverage: "10" },
    ]);

    expect(findBaseScholarshipAverageRange(8, 8.9)?.value).toBe("8-8.9");
    expect(resolveBaseScholarshipAverageRange("9-10")).toMatchObject({
      minAverage: "9",
      maxAverage: "10",
    });
    expect(findBaseScholarshipAverageRange(5, 5.9)).toBeNull();
  });

  it("keeps plantel, tier, percent, and average controls in the base scholarship form", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/admin/BenefitsClient.tsx"),
      "utf8",
    );

    expect(source).toContain("<span id={baseCampusId}>Plantel</span>");
    expect(source).toContain("<span id={baseTierId}>Tier</span>");
    expect(source).toContain("<input type=\"hidden\" name=\"campusId\" value={baseCampus} />");
    expect(source).toContain("<span id={basePercentId}>% de beca</span>");
    expect(source).toContain("<span id={baseAverageRangeId}>Promedio</span>");
  });
});
