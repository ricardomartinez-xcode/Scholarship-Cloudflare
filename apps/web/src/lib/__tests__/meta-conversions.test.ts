import { describe, expect, it } from "vitest";

import {
  buildMetaConversionsRequestBody,
  normalizePhoneForConversions,
} from "@/lib/meta-conversions";

describe("meta-conversions helpers", () => {
  it("normalizes phone numbers to digits only", () => {
    expect(normalizePhoneForConversions("+52 55 1234 5678")).toBe("525512345678");
    expect(normalizePhoneForConversions("(555) 123-4567")).toBe("5551234567");
    expect(normalizePhoneForConversions("")).toBeNull();
  });

  it("builds a business messaging payload for WhatsApp", () => {
    const result = buildMetaConversionsRequestBody({
      eventName: "Lead",
      userData: {
        external_id: ["hashed-contact-id"],
        ph: ["hashed-phone"],
      },
      value: 2500,
      currency: "mxn",
      eventSourceUrl: "https://recalc.relead.com.mx/app/unidep",
      testEventCode: "TEST123",
    });

    expect(result.eventId).toBeTruthy();
    expect(result.body.test_event_code).toBe("TEST123");
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0]).toMatchObject({
      event_name: "Lead",
      action_source: "business_messaging",
      messaging_channel: "whatsapp",
      user_data: {
        external_id: ["hashed-contact-id"],
        ph: ["hashed-phone"],
      },
      custom_data: {
        currency: "MXN",
        value: 2500,
      },
      event_source_url: "https://recalc.relead.com.mx/app/unidep",
    });
  });
});
