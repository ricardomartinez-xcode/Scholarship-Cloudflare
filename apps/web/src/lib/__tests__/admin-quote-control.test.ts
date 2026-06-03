import { describe, expect, it } from "vitest";

import { inspectAdminQuotePayload } from "@/lib/admin-quote-control";

describe("admin quote control", () => {
  it("reports missing canonical quote fields before touching the quote engine", () => {
    const diagnostics = inspectAdminQuotePayload({
      businessLine: "licenciatura",
      modality: "online",
    });

    expect(diagnostics).toEqual({
      ok: false,
      missing: ["enrollmentType", "plan", "average"],
      invalid: [],
      normalized: {
        enrollmentType: null,
        businessLine: "licenciatura",
        modality: "online",
        plan: null,
        average: null,
        subjectCount: null,
        module: null,
        extraChargeAmount: 0,
        campus: null,
        selectedProgramId: null,
        selectedProgramName: null,
        offeringId: null,
        offerCycle: null,
        clientSurface: "admin_control",
      },
    });
  });

  it("rejects invalid numeric quote fields", () => {
    const diagnostics = inspectAdminQuotePayload({
      enrollmentType: "nuevo_ingreso",
      businessLine: "licenciatura",
      modality: "online",
      plan: "0",
      average: "12",
      subjectCount: "-1",
      extraCharge: "-20",
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.invalid).toEqual(["plan", "average", "subjectCount", "extraCharge"]);
  });
});
