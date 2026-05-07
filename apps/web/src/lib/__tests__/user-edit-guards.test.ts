import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { getUserPrivilegeGuardError } from "@/lib/user-edit-guards";

function baseInput() {
  return {
    actorId: "actor",
    actorRole: Role.admin_operativo,
    targetId: "target",
    targetRole: Role.user,
    nextRole: Role.user,
    nextIsActive: true,
    userFieldsChanged: false,
    membershipsChanged: false,
    overridesChanged: false,
    userCapabilitiesChanged: false,
  };
}

describe("getUserPrivilegeGuardError", () => {
  it("blocks self privilege changes for non-owner", () => {
    const result = getUserPrivilegeGuardError({
      ...baseInput(),
      targetId: "actor",
      userFieldsChanged: true,
    });

    expect(result).toBe(
      "Solo owner puede modificar su propio rol, overrides o permisos visuales.",
    );
  });

  it("blocks promotion to owner for non-owner actors", () => {
    const result = getUserPrivilegeGuardError({
      ...baseInput(),
      nextRole: Role.owner,
      userFieldsChanged: true,
    });

    expect(result).toBe("Solo owner puede elevar una cuenta al rol owner.");
  });

  it("blocks non-owner edits against owner accounts", () => {
    const result = getUserPrivilegeGuardError({
      ...baseInput(),
      targetRole: Role.owner,
      nextRole: Role.owner,
      membershipsChanged: true,
    });

    expect(result).toBe("Solo owner puede modificar una cuenta owner.");
  });

  it("allows owner self-edits while preserving owner role and active state", () => {
    const result = getUserPrivilegeGuardError({
      ...baseInput(),
      actorId: "owner-id",
      actorRole: Role.owner,
      targetId: "owner-id",
      targetRole: Role.owner,
      nextRole: Role.owner,
      nextIsActive: true,
      membershipsChanged: true,
    });

    expect(result).toBeNull();
  });
});
