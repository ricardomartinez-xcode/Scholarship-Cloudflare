/**
 * Unit tests for invitation lifecycle state machine.
 *
 * These tests exercise `computeInviteStatus` and `InviteLifecycleError`
 * in isolation — no database is required.
 *
 * Lifecycle states under test:
 *   pending  → normal, valid invite
 *   used     → invite already consumed
 *   expired  → TTL elapsed before acceptance
 *   cancelled → admin explicitly cancelled (cancelledAt set, or legacy expiresAt=createdAt)
 */

import { describe, expect, it } from "vitest";

import { computeInviteStatus, InviteLifecycleError } from "@/lib/invites";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const future = (offsetMs = 7 * 24 * 60 * 60 * 1000) =>
  new Date(Date.now() + offsetMs);

const past = (offsetMs = 7 * 24 * 60 * 60 * 1000) =>
  new Date(Date.now() - offsetMs);

function pendingInvite(overrides: Partial<Parameters<typeof computeInviteStatus>[0]> = {}) {
  const createdAt = past(2 * 24 * 60 * 60 * 1000); // 2 days ago
  return {
    createdAt,
    expiresAt: future(5 * 24 * 60 * 60 * 1000), // 5 days from now
    usedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeInviteStatus
// ---------------------------------------------------------------------------

describe("computeInviteStatus", () => {
  describe("pending", () => {
    it("returns 'pending' for a fresh, valid invite", () => {
      expect(computeInviteStatus(pendingInvite())).toBe("pending");
    });
  });

  describe("used", () => {
    it("returns 'used' when usedAt is set", () => {
      expect(
        computeInviteStatus(pendingInvite({ usedAt: past(1000) })),
      ).toBe("used");
    });

    it("'used' takes precedence over expiry", () => {
      expect(
        computeInviteStatus(
          pendingInvite({ usedAt: past(1000), expiresAt: past(500) }),
        ),
      ).toBe("used");
    });
  });

  describe("expired", () => {
    it("returns 'expired' when expiresAt is in the past", () => {
      expect(
        computeInviteStatus(pendingInvite({ expiresAt: past(1000) })),
      ).toBe("expired");
    });

    it("returns 'expired' when expiresAt is just before now (boundary)", () => {
      expect(
        computeInviteStatus(
          pendingInvite({ expiresAt: new Date(Date.now() - 1) }),
        ),
      ).toBe("expired");
    });
  });

  describe("cancelled", () => {
    it("returns 'cancelled' when cancelledAt is set", () => {
      expect(
        computeInviteStatus(pendingInvite({ cancelledAt: past(1000) })),
      ).toBe("cancelled");
    });

    it("returns 'cancelled' via legacy signal (expiresAt === createdAt)", () => {
      const createdAt = past(2 * 24 * 60 * 60 * 1000);
      expect(
        computeInviteStatus({
          createdAt,
          expiresAt: createdAt, // legacy cancel hack
          usedAt: null,
          cancelledAt: null,
        }),
      ).toBe("cancelled");
    });

    it("'cancelled' takes precedence over expiry", () => {
      expect(
        computeInviteStatus(
          pendingInvite({ cancelledAt: past(500), expiresAt: past(1000) }),
        ),
      ).toBe("cancelled");
    });
  });
});

// ---------------------------------------------------------------------------
// InviteLifecycleError
// ---------------------------------------------------------------------------

describe("InviteLifecycleError", () => {
  it("is an instance of Error", () => {
    const err = new InviteLifecycleError("test", "INVITE_NOT_FOUND");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(InviteLifecycleError);
  });

  it("exposes the code property", () => {
    const err = new InviteLifecycleError("test", "WRONG_EMAIL");
    expect(err.code).toBe("WRONG_EMAIL");
  });

  it("carries the message", () => {
    const err = new InviteLifecycleError("La invitación no corresponde a este correo.", "WRONG_EMAIL");
    expect(err.message).toBe("La invitación no corresponde a este correo.");
  });

  it("has the correct name", () => {
    const err = new InviteLifecycleError("test", "INVITE_EXPIRED");
    expect(err.name).toBe("InviteLifecycleError");
  });

  const allCodes: Array<InviteLifecycleError["code"]> = [
    "INVITE_NOT_FOUND",
    "INVITE_ALREADY_USED",
    "INVITE_EXPIRED",
    "INVITE_CANCELLED",
    "WRONG_EMAIL",
    "INVALID_TRANSITION",
  ];

  it.each(allCodes)("accepts code %s", (code) => {
    const err = new InviteLifecycleError("msg", code);
    expect(err.code).toBe(code);
  });
});
