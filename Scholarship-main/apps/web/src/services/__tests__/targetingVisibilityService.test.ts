import { Role, UserCapability } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { evaluateVisibilityRule } from "@/services/targetingVisibilityService";

describe("evaluateVisibilityRule", () => {
  it("prioriza exclusión cuando hay inclusión por organización", () => {
    const result = evaluateVisibilityRule(
      {
        organizationId: "org-a",
        excludeOrganizationIds: ["org-a"],
      },
      {
        userId: "user-1",
        organizationIds: ["org-a"],
      },
    );

    expect(result.visible).toBe(false);
    expect(result.reason).toBe("excluded_organization");
  });

  it("bloquea appliesToAll cuando el rol está excluido", () => {
    const result = evaluateVisibilityRule(
      {
        excludeRoles: [Role.user],
      },
      {
        userId: "user-2",
        roles: [Role.user],
      },
    );

    expect(result.visible).toBe(false);
    expect(result.reason).toBe("excluded_role");
  });

  it("bloquea requiredCapability cuando también está en exclusión", () => {
    const result = evaluateVisibilityRule(
      {
        requiredCapability: UserCapability.access_admin_cta,
        excludeCapabilities: [UserCapability.access_admin_cta],
      },
      {
        userId: "user-3",
        capabilities: [UserCapability.access_admin_cta],
      },
    );

    expect(result.visible).toBe(false);
    expect(result.reason).toBe("excluded_capability");
  });

  it("bloquea onlyNewUsers cuando el usuario está explícitamente excluido", () => {
    const result = evaluateVisibilityRule(
      {
        newUserOnly: true,
        excludeUserIds: ["user-4"],
      },
      {
        userId: "user-4",
        newUser: true,
      },
    );

    expect(result.visible).toBe(false);
    expect(result.reason).toBe("excluded_user");
  });
});
