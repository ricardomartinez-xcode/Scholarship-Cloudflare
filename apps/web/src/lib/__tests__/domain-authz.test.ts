import { describe, expect, it } from "vitest";

import { isAllowedEmail } from "@/lib/domain";

describe("auth domain policy", () => {
  it("allows ReLead operator accounts without requiring an invite", () => {
    expect(isAllowedEmail("ricardomartinez@relead.com.mx")).toBe(true);
    expect(isAllowedEmail("ops@relead.com.mx")).toBe(true);
  });
});
