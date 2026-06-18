import { describe, expect, it } from "vitest";

import {
  auditPricingCodeSnapshot,
  normalizeAutoAuditReport,
} from "@/lib/autopilot-core";

describe("Autopilot pricing audit rules", () => {
  it("flags legacy base price scopes and quote fallback code", () => {
    const findings = auditPricingCodeSnapshot({
      "apps/web/src/lib/pricing-options.ts": `
        export async function listPricingOptions() {
          return prisma.scholarshipRule.findMany({ where: { scope: "monto" } });
        }
      `,
      "apps/web/src/lib/scholarship-quote-service.ts": `
        const fallbackPrice = findStaticBasePrice(input) ?? basePriceFromRules(input);
      `,
    });

    expect(findings.map((finding) => finding.checkId)).toEqual(
      expect.arrayContaining([
        "pricing.base_price_scope_legacy",
        "quote.base_price_legacy_fallback",
      ]),
    );
    expect(findings.every((finding) => finding.severity === "P0")).toBe(true);
    expect(findings.every((finding) => finding.repairable === true)).toBe(true);
  });

  it("accepts the published base price scope without fallback pricing", () => {
    const findings = auditPricingCodeSnapshot({
      "apps/web/src/lib/pricing-options.ts": `
        import { BASE_PRICE_OVERRIDE_SCOPE } from "@/lib/admin-price-scope";
        export const where = { scope: BASE_PRICE_OVERRIDE_SCOPE };
      `,
      "apps/web/src/lib/scholarship-quote-service.ts": `
        if (!publishedBasePrice) {
          throw new Error("No hay precio publicado vigente para esta cotizacion.");
        }
      `,
    });

    expect(findings).toEqual([]);
  });

  it("normalizes uploaded audit report findings for persistence", () => {
    const report = normalizeAutoAuditReport({
      auditRunId: "audit-1",
      status: "ready",
      headSha: "abcdef123456",
      summary: { ok: false, failed: 1 },
      findings: [
        {
          checkId: "pricing.base_price_scope_legacy",
          severity: "unknown",
          domain: "pricing",
          title: "Uses legacy scope",
          message: "scope monto detected",
          filePath: "apps/web/src/lib/pricing-options.ts",
          line: 12,
          repairable: true,
          suggestedAction: "Use BASE_PRICE_OVERRIDE_SCOPE.",
        },
      ],
    });

    expect(report.auditRunId).toBe("audit-1");
    expect(report.status).toBe("ready");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      checkId: "pricing.base_price_scope_legacy",
      severity: "P2",
      domain: "pricing",
      repairable: true,
    });
  });
});
