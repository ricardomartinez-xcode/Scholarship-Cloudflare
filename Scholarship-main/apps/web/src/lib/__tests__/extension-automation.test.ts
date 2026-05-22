import { describe, expect, it } from "vitest";

import {
  parseCampaignRecipientText,
  renderCampaignMessageTemplate,
  resolveExtensionCampaignBusinessStatus,
  resolveExtensionCampaignCompletionStatus,
  sanitizeCampaignRecipients,
} from "@/lib/extension-automation";

describe("sanitizeCampaignRecipients", () => {
  it("deduplica destinatarios por contactValue normalizado", () => {
    const recipients = sanitizeCampaignRecipients([
      { contactValue: "  +52 555 111 2222  ", contactName: "Uno" },
      { contactValue: "+52 555 111 2222", contactName: "Duplicado" },
      { contactValue: "contacto-2", contactName: "Dos" },
    ]);

    expect(recipients).toHaveLength(2);
    expect(recipients[0]?.contactValue).toBe("+525551112222");
    expect(recipients[1]?.contactValue).toBe("contacto-2");
  });

  it("elimina filas vacías", () => {
    const recipients = sanitizeCampaignRecipients([
      { contactValue: " " },
      { contactValue: "\n" },
      { contactValue: "contacto-valido" },
    ]);

    expect(recipients).toEqual([
      expect.objectContaining({ contactValue: "contacto-valido" }),
    ]);
  });
});

describe("parseCampaignRecipientText", () => {
  it("convierte líneas nombre,número a destinatarios", () => {
    const recipients = parseCampaignRecipientText(
      ["Ana Gómez, 5215512345678", "525512345679"].join("\n"),
    );

    expect(recipients).toEqual([
      expect.objectContaining({
        contactName: "Ana Gómez",
        contactValue: "5215512345678",
      }),
      expect.objectContaining({
        contactName: null,
        contactValue: "525512345679",
      }),
    ]);
  });

  it("detecta encabezados y delimitadores alternos", () => {
    const recipients = parseCampaignRecipientText(
      [
        "Nombre completo;Teléfono;Notas",
        "\"Ana Gómez\";\"+52 55 1234 5678\";VIP",
        "\"Bruno Ruiz\";\"525512345679\";Seguimiento",
      ].join("\n"),
    );

    expect(recipients).toEqual([
      expect.objectContaining({
        contactName: "Ana Gómez",
        contactValue: "+52 55 1234 5678",
      }),
      expect.objectContaining({
        contactName: "Bruno Ruiz",
        contactValue: "525512345679",
      }),
    ]);
  });
});

describe("renderCampaignMessageTemplate", () => {
  it("inyecta nombre y número cuando existen tokens", () => {
    const message = renderCampaignMessageTemplate(
      "Hola {{nombre}}, te contacto al {{numero}}",
      { contactName: "Ana", contactValue: "+52 55 1234 5678" },
    );

    expect(message).toBe("Hola Ana, te contacto al +525512345678");
  });
});

describe("resolveExtensionCampaignCompletionStatus", () => {
  it("marca sent cuando todos los destinatarios se enviaron", () => {
    expect(
      resolveExtensionCampaignCompletionStatus({
        totalRecipients: 4,
        sentRecipients: 4,
        failedRecipients: 0,
      }),
    ).toBe("sent");
  });

  it("marca failed cuando no hubo envíos exitosos", () => {
    expect(
      resolveExtensionCampaignCompletionStatus({
        totalRecipients: 3,
        sentRecipients: 0,
        failedRecipients: 3,
      }),
    ).toBe("failed");
  });

  it("marca partial cuando mezcla envíos y errores", () => {
    expect(
      resolveExtensionCampaignCompletionStatus({
        totalRecipients: 5,
        sentRecipients: 3,
        failedRecipients: 2,
      }),
    ).toBe("partial");
  });
});

describe("resolveExtensionCampaignBusinessStatus", () => {
  it("mapea partial a completed_with_issues para UX de cierre", () => {
    expect(resolveExtensionCampaignBusinessStatus("partial")).toBe(
      "completed_with_issues",
    );
  });

  it("mapea sent/completed a completed", () => {
    expect(resolveExtensionCampaignBusinessStatus("sent")).toBe("completed");
    expect(resolveExtensionCampaignBusinessStatus("completed")).toBe("completed");
  });
});
