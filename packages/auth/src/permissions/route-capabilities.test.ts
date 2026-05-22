import { AdminCapability } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { requiredRouteCapabilities } from "./route-capabilities";

describe("admin route capabilities", () => {
  it("covers active admin pricing and catalog routes", () => {
    expect(requiredRouteCapabilities("/admin/prices")).toContain(
      AdminCapability.manage_prices,
    );
    expect(requiredRouteCapabilities("/admin/unidep/fees")).toContain(
      AdminCapability.manage_prices,
    );
    expect(requiredRouteCapabilities("/admin/unidep/directory")).toContain(
      AdminCapability.manage_directory,
    );
  });

  it("uses the nearest parent capability for nested admin routes", () => {
    expect(
      requiredRouteCapabilities("/admin/whatsapp-templates/some-child"),
    ).toEqual([
      AdminCapability.view_admin_operations,
      AdminCapability.manage_ctas,
    ]);
  });
});
