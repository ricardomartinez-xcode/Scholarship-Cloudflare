import { describe, expect, it } from "vitest";

import { serializeBaseScholarshipRows } from "@/lib/admin-base-scholarships";

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
      },
    ]);
  });
});
