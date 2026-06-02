import { describe, expect, it } from "vitest";

import {
  buildCtaActionConfig,
  extractCtaActionConfigFromRule,
  mergeCtaActionConfigIntoVisibilityRule,
  parseCtaPopupTable,
} from "@/lib/cta-action-config";

describe("cta action config", () => {
  it("parses simple popup tables from admin text input", () => {
    expect(parseCtaPopupTable("Concepto | Monto\nInscripción | $1,000\nColegiatura | $2,000")).toEqual({
      columns: ["Concepto", "Monto"],
      rows: [
        ["Inscripción", "$1,000"],
        ["Colegiatura", "$2,000"],
      ],
    });
  });

  it("keeps targeting visibility fields when adding popup config", () => {
    const config = buildCtaActionConfig({
      type: "popup",
      title: "Detalle de beca",
      message: "Aplica solo durante junio.",
      tableRaw: "",
      image: null,
    });

    const merged = mergeCtaActionConfigIntoVisibilityRule(
      {
        organizationId: "org-1",
        excludeRoles: ["user"],
      },
      config,
    );

    expect(merged).toMatchObject({
      organizationId: "org-1",
      excludeRoles: ["user"],
      ctaAction: {
        type: "popup",
        title: "Detalle de beca",
        message: "Aplica solo durante junio.",
      },
    });
  });

  it("extracts stored popup config without treating unknown JSON as valid", () => {
    expect(
      extractCtaActionConfigFromRule({
        ctaAction: {
          type: "popup",
          title: "Calendario",
          message: "",
          table: {
            columns: ["Fecha", "Actividad"],
            rows: [["2026-06-15", "Inicio"]],
          },
        },
      }),
    ).toEqual({
      type: "popup",
      title: "Calendario",
      message: null,
      image: null,
      table: {
        columns: ["Fecha", "Actividad"],
        rows: [["2026-06-15", "Inicio"]],
      },
    });

    expect(extractCtaActionConfigFromRule({ ctaAction: { type: "popup" } })).toBeNull();
  });
});
