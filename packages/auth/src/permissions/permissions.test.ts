import { AdminCapability } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { can } from "@relead/auth/permissions/client";
import { assertCapability } from "@relead/auth/permissions/guards";

describe("permissions helpers", () => {
  it("rechaza usuario sin permiso", () => {
    expect(can([], [AdminCapability.manage_prices])).toBe(false);
    expect(assertCapability({ capabilities: [] }, AdminCapability.manage_prices)).toBe(false);
  });

  it("acepta usuario con permiso", () => {
    expect(can([AdminCapability.manage_prices], [AdminCapability.manage_prices])).toBe(true);
    expect(
      assertCapability(
        { capabilities: [AdminCapability.manage_prices] },
        AdminCapability.manage_prices,
      ),
    ).toBe(true);
  });
});
