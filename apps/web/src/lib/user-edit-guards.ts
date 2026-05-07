import { Role } from "@prisma/client";

type UserPrivilegeGuardInput = {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  nextRole: Role;
  nextIsActive: boolean;
  userFieldsChanged: boolean;
  membershipsChanged: boolean;
  overridesChanged: boolean;
  userCapabilitiesChanged: boolean;
};

export function getUserPrivilegeGuardError(
  input: UserPrivilegeGuardInput,
): string | null {
  const isSelf = input.targetId === input.actorId;
  const actorIsOwner = input.actorRole === Role.owner;
  const targetIsOwner = input.targetRole === Role.owner;

  if (
    isSelf &&
    !actorIsOwner &&
    (input.userFieldsChanged || input.overridesChanged || input.userCapabilitiesChanged)
  ) {
    return "Solo owner puede modificar su propio rol, overrides o permisos visuales.";
  }

  if (!actorIsOwner && input.nextRole === Role.owner && input.targetRole !== Role.owner) {
    return "Solo owner puede elevar una cuenta al rol owner.";
  }

  if (targetIsOwner && !actorIsOwner) {
    return "Solo owner puede modificar una cuenta owner.";
  }

  if (targetIsOwner && input.nextRole !== Role.owner) {
    return "Las cuentas owner deben conservar el rol owner.";
  }

  if (targetIsOwner && !input.nextIsActive) {
    return "No se puede desactivar una cuenta owner.";
  }

  return null;
}
