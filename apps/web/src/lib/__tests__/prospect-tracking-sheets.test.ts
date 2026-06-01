import { describe, expect, it } from "vitest";

import {
  GOOGLE_CONTACTS_SHEET_NAME,
  PROSPECT_TRACKING_SHEETS,
  buildProspectTrackingSheets,
} from "@/lib/prospect-tracking-sheets";

describe("prospect tracking sheets", () => {
  it("genera el workbook con las hojas y encabezados del seguimiento ReLead", () => {
    const sheets = buildProspectTrackingSheets({
      contacts: [],
      campaigns: [],
      generatedAt: "2026-06-01T12:00:00.000Z",
    });

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "Campañas",
      "Seguimiento",
      "Contactos",
      "Metadatos",
    ]);
    expect(GOOGLE_CONTACTS_SHEET_NAME).toBe("Contactos");
    expect(PROSPECT_TRACKING_SHEETS.map((sheet) => sheet.sheetName)).toEqual([
      "Seguimiento",
      "Campañas",
      "Contactos",
      "Metadatos",
    ]);
    expect(sheets.find((sheet) => sheet.name === "Seguimiento")?.values[0]).toEqual([
      "seguimiento_id",
      "contact_key",
      "expediente",
      "nombre",
      "telefono",
      "correo",
      "linea",
      "programa",
      "plantel",
      "toque",
      "whatsapp_estado",
      "correo_estado",
      "llamada_estado",
      "sms_estado",
      "clasificacion",
      "motivo",
      "resolucion",
      "prioridad",
      "siguiente_accion",
      "propietario",
      "campaign_id",
      "notas",
      "actualizado_en",
      "fuente",
    ]);
  });

  it("mapea contactos y campañas disponibles sin depender de una hoja pública", () => {
    const sheets = buildProspectTrackingSheets({
      ownerEmail: "asesor@example.com",
      generatedAt: "2026-06-01T12:00:00.000Z",
      contacts: [
        {
          id: "contact-1",
          contactName: "Prospecto Uno",
          phone: "(555) 123 4567",
          normalizedPhone: "5551234567",
          email: "prospecto@example.com",
          tags: ["online"],
          personalData: null,
          notes: "Pidió llamada",
          lastWhatsappMessageAt: "2026-06-01T11:00:00.000Z",
          lastWhatsappMessageText: "Hola",
          campaignMessageCount: 2,
          assignedQuoteSessionPublicId: null,
          assignedScenarioId: null,
          source: "manual",
          updatedAt: "2026-06-01T11:30:00.000Z",
        },
      ],
      campaigns: [
        {
          id: "campaign-1",
          campaignName: "Seguimiento junio",
          channel: "whatsapp_web",
          status: "partial",
          scheduleAt: null,
          batchSize: 25,
          messageDelayMs: 4000,
          messageTemplate: "Hola {{nombre}}",
          notes: null,
          updatedAt: "2026-06-01T10:00:00.000Z",
          recipients: [
            {
              contactValue: "5551234567",
              contactName: "Prospecto Uno",
              status: "sent",
              updatedAt: "2026-06-01T10:15:00.000Z",
            },
            {
              contactValue: "5550000000",
              contactName: "Prospecto Dos",
              status: "failed",
              updatedAt: "2026-06-01T10:16:00.000Z",
            },
          ],
        },
      ],
    });

    const campanas = sheets.find((sheet) => sheet.name === "Campañas");
    const seguimiento = sheets.find((sheet) => sheet.name === "Seguimiento");
    const contactos = sheets.find((sheet) => sheet.name === "Contactos");

    expect(campanas?.values[1]?.slice(0, 4)).toEqual([
      "campaign-1",
      "Seguimiento junio",
      "whatsapp_web",
      "partial",
    ]);
    expect(campanas?.values[1]?.[7]).toBe(2);
    expect(campanas?.values[1]?.[8]).toBe(1);
    expect(campanas?.values[1]?.[9]).toBe(1);

    expect(seguimiento?.values[1]?.[1]).toBe("5551234567");
    expect(seguimiento?.values[1]?.[10]).toBe("Con contacto");
    expect(seguimiento?.values[1]?.[19]).toBe("asesor@example.com");
    expect(seguimiento?.values[1]?.[20]).toBe("campaign-1");

    expect(contactos?.values[1]?.[0]).toBe("5551234567");
    expect(contactos?.values[1]?.[9]).toBe("Contactable");
    expect(contactos?.values[1]?.[13]).toBe(2);
  });
});
