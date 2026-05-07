import { describe, expect, it } from "vitest";

import {
  InviteLifecycleError,
  evaluateInviteAcceptanceState,
} from "@/lib/invites";

const baseInvite = {
  email: "persona@recalc.mx",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2026-01-08T00:00:00.000Z"),
  usedAt: null as Date | null,
  cancelledAt: null as Date | null,
};

describe("evaluateInviteAcceptanceState", () => {
  it("permite aceptar cuando sigue pendiente", () => {
    expect(
      evaluateInviteAcceptanceState(
        { ...baseInvite },
        "persona@recalc.mx",
        new Date("2026-01-03T10:00:00.000Z"),
      ),
    ).toBe("accept");
  });

  it("trata como idempotente cuando ya fue usada por el mismo correo", () => {
    expect(
      evaluateInviteAcceptanceState(
        { ...baseInvite, usedAt: new Date("2026-01-02T12:00:00.000Z") },
        "persona@recalc.mx",
        new Date("2026-01-03T10:00:00.000Z"),
      ),
    ).toBe("already_used");
  });

  it("rechaza invitación vencida", () => {
    try {
      evaluateInviteAcceptanceState(
        { ...baseInvite },
        "persona@recalc.mx",
        new Date("2026-01-09T00:00:00.000Z"),
      );
      throw new Error("expected-error");
    } catch (error) {
      expect(error).toBeInstanceOf(InviteLifecycleError);
      expect((error as InviteLifecycleError).code).toBe("INVITE_EXPIRED");
    }
  });

  it("rechaza cuando la sesión tiene otro correo", () => {
    try {
      evaluateInviteAcceptanceState(
        { ...baseInvite },
        "otro@recalc.mx",
        new Date("2026-01-03T10:00:00.000Z"),
      );
      throw new Error("expected-error");
    } catch (error) {
      expect(error).toBeInstanceOf(InviteLifecycleError);
      expect((error as InviteLifecycleError).code).toBe("WRONG_EMAIL");
    }
  });
});
