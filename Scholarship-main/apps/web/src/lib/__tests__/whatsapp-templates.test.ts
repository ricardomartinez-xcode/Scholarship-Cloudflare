import { describe, expect, it } from "vitest";

import {
  buildWhatsappTemplatePreview,
  getFallbackWhatsappTemplateCollection,
  normalizeWhatsappTemplateFieldOrder,
  validateWhatsappTemplateBaseText,
} from "../whatsapp-templates";

const previewData = {
  campusLabel: "Campus Norte",
  programLabel: "Medicina",
  businessLineLabel: "Salud",
  modalityLabel: "Presencial",
  planLabel: "4",
  enrollmentTypeLabel: "Nuevo ingreso",
  scheduleLabel: "Matutino",
  listPrice: 5400,
  scholarshipText: "35% (-$1,890.00)",
  scholarshipPercentText: "35%",
  scholarshipAmountText: "$1,890.00",
  additionalBenefitText: "10% (-$540.00)",
  additionalBenefitPercentText: "10%",
  additionalBenefitAmountText: "$540.00",
  firstPaymentText: "$1,650.00",
  additionalChargeText: "Examen de admisión $350.00",
  subtotal: 2970,
  total: 3320,
  notes: "Monto sujeto a validación documental.",
  callToAction: "Escríbeme y revisamos documentos.",
} as const;

describe("normalizeWhatsappTemplateFieldOrder", () => {
  it("extrae posiciones únicas del texto", () => {
    const text = "Hola {{1}}\n{{2}} — {{1}}\nTotal: {{18}}";
    expect(normalizeWhatsappTemplateFieldOrder(text)).toEqual([1, 2, 18]);
  });

  it("ignora posiciones fuera de rango (>20 o <1)", () => {
    const text = "{{0}} {{21}} {{99}} {{1}}";
    expect(normalizeWhatsappTemplateFieldOrder(text)).toEqual([1]);
  });

  it("retorna [] para texto null/undefined/vacío", () => {
    expect(normalizeWhatsappTemplateFieldOrder(null)).toEqual([]);
    expect(normalizeWhatsappTemplateFieldOrder(undefined)).toEqual([]);
    expect(normalizeWhatsappTemplateFieldOrder("")).toEqual([]);
  });

  it("retorna [] para texto sin tokens", () => {
    expect(normalizeWhatsappTemplateFieldOrder("Hola, sin variables")).toEqual([]);
  });

  it("retorna posiciones en orden ascendente (sin duplicados)", () => {
    const text = "{{18}} {{2}} {{18}} {{1}}";
    expect(normalizeWhatsappTemplateFieldOrder(text)).toEqual([1, 2, 18]);
  });
});

describe("validateWhatsappTemplateBaseText", () => {
  it("acepta texto con posiciones 1..20", () => {
    expect(() => validateWhatsappTemplateBaseText("{{1}} {{20}}")).not.toThrow();
  });

  it("lanza error si posición > 20", () => {
    expect(() => validateWhatsappTemplateBaseText("{{21}}")).toThrow();
  });

  it("lanza error si posición == 0", () => {
    expect(() => validateWhatsappTemplateBaseText("{{0}}")).toThrow();
  });

  it("lanza error si hay token nombrado (sintaxis antigua)", () => {
    expect(() => validateWhatsappTemplateBaseText("{{campus}}")).toThrow();
  });

  it("acepta texto vacío/null sin lanzar error", () => {
    expect(() => validateWhatsappTemplateBaseText(null)).not.toThrow();
    expect(() => validateWhatsappTemplateBaseText("")).not.toThrow();
  });
});

describe("buildWhatsappTemplatePreview", () => {
  it("usa el catálogo global para tokens posicionales", () => {
    const preview = buildWhatsappTemplatePreview(
      {
        baseText: "Plantel {{1}} · Programa {{2}} · Total {{18}}",
        fieldOrder: [20, 3, 4],
      },
      previewData,
    );

    expect(preview).toContain("Campus Norte");
    expect(preview).toContain("Medicina");
    expect(preview).toContain("$3,320.00");
    expect(preview).not.toContain("Siguiente paso:");
  });

  it("mantiene compatibilidad con fieldOrder legacy cuando el baseText no tiene variables", () => {
    const preview = buildWhatsappTemplatePreview(
      {
        baseText: "Hola, te comparto la cotización estimada:",
        fieldOrder: ["campus", "total", "call_to_action"],
      },
      previewData,
    );

    expect(preview).toContain("Hola, te comparto la cotización estimada:");
    expect(preview).toContain("Plantel: Campus Norte");
    expect(preview).toContain("Total final: $3,320.00");
    expect(preview).toContain("Siguiente paso: Escríbeme y revisamos documentos.");
  });

  it("no agrega líneas adjuntas si el mensaje ya usa variables inline", () => {
    const preview = buildWhatsappTemplatePreview(
      {
        baseText: "Hola {{2}}, tu total es {{18}}.",
        fieldOrder: ["campus", "total", "call_to_action"],
      },
      previewData,
    );

    expect(preview).toContain("Hola Medicina, tu total es $3,320.00.");
    expect(preview).not.toContain("Plantel:");
    expect(preview).not.toContain("Siguiente paso:");
  });

  it("renderiza tokens nombrados antiguos para no dejar previews en blanco", () => {
    const preview = buildWhatsappTemplatePreview(
      {
        baseText: "Hola {{program}} en {{campus}}.",
      },
      previewData,
    );

    expect(preview).toContain("Hola Medicina en Campus Norte.");
  });
});

describe("getFallbackWhatsappTemplateCollection", () => {
  it("expone las 6 plantillas oficiales humanizadas", () => {
    const collection = getFallbackWhatsappTemplateCollection();

    expect(collection.templates).toHaveLength(6);
    expect(collection.templates.map((template) => template.name)).toEqual([
      "Primer contacto / Resumen",
      "Primer contacto / Detallado",
      "Seguimiento / Resumen",
      "Seguimiento / Detallado",
      "Cierre / Resumen",
      "Cierre / Detallado",
    ]);
    expect(
      collection.templates.find((template) => template.isDefaultOfficial)?.systemKey,
    ).toBe("official-first-contact-detailed");
    expect(collection.defaultOfficialTemplateId).toBeTruthy();
  });
});
