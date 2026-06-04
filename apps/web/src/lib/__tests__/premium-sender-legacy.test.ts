import { describe, expect, it } from "vitest";

import { buildLegacyLicense, decryptLegacyPayload, encryptLegacyPayload } from "@/lib/premium-sender-legacy";

describe("premium sender compatibility backend", () => {
  it("returns totalaccess entitlement for ReCalc sender checks", () => {
    const response = buildLegacyLicense({
      device_code: "device-1",
      device_name: "QA device",
      mobile: "525512345678",
    });

    expect(response.status).toBe("success");
    expect(response.data.license).toBe("totalaccess");
    expect(response.data.license_key).toBe("totalaccess");
    expect(response.data.plan).toBe("totalaccess");
    expect(response.data.entitlement).toBe("totalaccess");
    expect(response.data.license_required).toBe(false);
    expect(response.data.server).toBe("recalc");
  });

  it("keeps the encrypted payload contract readable by the extension", () => {
    const encrypted = encryptLegacyPayload({ license: "totalaccess" });

    expect(decryptLegacyPayload(encrypted)).toEqual({ license: "totalaccess" });
  });
});
