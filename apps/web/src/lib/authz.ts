/**
 * authz.ts — Session validation layer (authentication + basic authorization).
 *
 * Answers: "Is this HTTP session attached to a valid, active user?"
 * Resolves the current user record, applies email-based allow/deny rules,
 * and exposes `SessionUserState` as the canonical session descriptor
 * consumed by pages and server actions.
 *
 * Layering:
 *   auth/server.ts  →  authz.ts  →  admin-session.ts  →  api-auth.ts
 *
 * For API-level capability checks (does this admin user have capability X?),
 * use `api-auth.ts`. For admin panel access checks, use `admin-session.ts`.
 */
import { Role, type User } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import {
  EXTENSION_SESSION_TOKEN_HEADER,
  getExtensionAuthSession,
} from "@/lib/extension-auth";
import { isAllowedEmail } from "@/lib/domain";
import { normalizeEmail } from "@/lib/normalize";
import { captureException } from "@/lib/observability";
import {
  getIssuedExtensionSessionUser,
  isIssuedExtensionToken,
} from "@/lib/extension-session-tokens";
import { prisma } from "@/lib/prisma";
import { canAccessAdminPanel, resolveAdminCapabilities } from "@/lib/admin-capabilities";
import {
  canSignInWithCloudflareEmail,
  canSignUpWithCloudflareEmail,
  getCloudflareSessionUser,
} from "@/lib/cloudflare/auth";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";

const LAST_LOGIN_UPDATE_INTERVAL_MS = 15 * 60 * 1000;

type SessionIdentity = {
  authUserId: string;
  email: string;
};

export type SessionUserState =
  | { status: "unauthenticated"; user: null; email: null }
  | { status: "forbidden"; user: null; email: string }
  | { status: "inactive"; user: User; email: string }
  | { status: "ok"; user: User; email: string };

const resolveSessionIdentity = (user: unknown): SessionIdentity | null => {
  const casted = user as {
    id?: string | null;
    email?: string | null;
    primaryEmail?: string | null;
  };
  const authUserId = String(casted?.id ?? "").trim();
  const email = normalizeEmail(casted?.email ?? casted?.primaryEmail ?? null);
  if (!authUserId || !email) return null;
  return { authUserId, email };
};

const hasPendingInvite = async (email: string) => {
  const invite = await prisma.invite.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      usedAt: null,
      cancelledAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(invite);
};

const hasInviteHistory = async (email: string) => {
  const invite = await prisma.invite.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
    },
    select: { id: true },
  });
  return Boolean(invite);
};

const getPendingInvite = async (email: string) => {
  return prisma.invite.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      usedAt: null,
      cancelledAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, role: true, organizationId: true },
  });
};

function shouldRefreshLastLogin(lastLoginAt: Date | null | undefined, now: Date) {
  if (!lastLoginAt) return true;
  return now.getTime() - lastLoginAt.getTime() >= LAST_LOGIN_UPDATE_INTERVAL_MS;
}

const syncUserRecord = async (identity: SessionIdentity) => {
  let user =
    (await prisma.user.findUnique({ where: { authUserId: identity.authUserId } })) ??
    (await prisma.user.findUnique({ where: { email: identity.email } }));

  if (!user) {
    const allowedByDomain = isAllowedEmail(identity.email);

    // Invite-only sign-ups are allowed to create the account, but the invite is
    // only consumed later from the explicit accept flow.
    let pendingInvite: { id: string; role: Role; organizationId: string | null } | null = null;
    if (!allowedByDomain) {
      pendingInvite = await getPendingInvite(identity.email);
      if (!pendingInvite) return null;
    }

    try {
      user = await prisma.user.create({
        data: {
          authUserId: identity.authUserId,
          email: identity.email,
          role: Role.user,
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
    } catch (err) {
      captureException(err, {
        module: "authz",
        action: "createUserFromSession",
        result: "failure",
        actorEmail: identity.email,
      }, "Failed to create user from session");
      throw err;
    }
    return user;
  }

  const now = new Date();
  const data: Partial<User> = {};

  if (user.email !== identity.email) {
    data.email = identity.email;
  }
  if (user.authUserId !== identity.authUserId) {
    data.authUserId = identity.authUserId;
  }
  if (shouldRefreshLastLogin(user.lastLoginAt, now)) {
    data.lastLoginAt = now;
  }

  if (Object.keys(data).length === 0) {
    return user;
  }

  user = await prisma.user.update({ where: { id: user.id }, data });

  return user;
};

export async function resolveSessionStateFromAuthUser(userCandidate: unknown): Promise<SessionUserState> {
  const identity = resolveSessionIdentity(userCandidate);
  if (!identity) {
    return { status: "forbidden", user: null, email: "" };
  }

  const user = await syncUserRecord(identity);
  if (!user) {
    return { status: "forbidden", user: null, email: identity.email };
  }
  if (!user.isActive) {
    return { status: "inactive", user, email: identity.email };
  }
  return { status: "ok", user, email: identity.email };
}

function readExtensionTokenFromRequestHeaders(requestHeaders: Headers) {
  const extensionHeaderToken =
    requestHeaders.get(EXTENSION_SESSION_TOKEN_HEADER)?.trim() ?? "";
  if (extensionHeaderToken) return extensionHeaderToken;

  const authorization = requestHeaders.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

async function getExtensionSessionTokenFromHeaders() {
  try {
    const requestHeaders = await headers();
    return readExtensionTokenFromRequestHeaders(requestHeaders);
  } catch {
    return "";
  }
}

export async function getSessionUserFromExtensionToken(
  extensionSessionToken: string,
): Promise<SessionUserState> {
  const normalizedToken = extensionSessionToken.trim();
  if (!normalizedToken) {
    return { status: "unauthenticated", user: null, email: null };
  }

  try {
    if (isIssuedExtensionToken(normalizedToken)) {
      const user = await getIssuedExtensionSessionUser(normalizedToken);
      if (!user) {
        return { status: "unauthenticated", user: null, email: null };
      }
      if (!user.isActive) {
        return { status: "inactive", user, email: user.email };
      }
      return { status: "ok", user, email: user.email };
    }

    if (isCloudflareRuntime()) {
      return { status: "unauthenticated", user: null, email: null };
    }

    // Backward compatibility for pre-4.6.2 extension tokens while users migrate.
    // New tokens should always use issueExtensionSessionToken().
    const extensionSession = await getExtensionAuthSession(normalizedToken);
    if (!extensionSession?.user) {
      return { status: "unauthenticated", user: null, email: null };
    }
    return resolveSessionStateFromAuthUser(extensionSession.user);
  } catch (err) {
    captureException(
      err,
      {
        module: "authz",
        action: "getSessionUserFromExtensionToken",
        result: "failure",
      },
      "Unexpected extension token resolution error",
    );
    return { status: "unauthenticated", user: null, email: null };
  }
}

export async function getSessionUser(): Promise<SessionUserState> {
  // Dev mode: check for SKIP_AUTH_REDIRECT flag
  if (process.env.SKIP_AUTH_REDIRECT === 'true' && process.env.NODE_ENV === 'development') {
    const devEmail = process.env.DEV_USER_EMAIL?.trim();
    if (devEmail) {
      try {
        // Create or fetch a dev user with the specified email
        let user = await prisma.user.findUnique({ where: { email: devEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              authUserId: 'dev-user-' + Date.now(),
              email: devEmail,
              role: Role.owner, // Dev users get owner role
              isActive: true,
              lastLoginAt: new Date(),
            },
          });
        }
        return { status: "ok", user, email: devEmail };
      } catch (err) {
        captureException(err, {
          module: "authz",
          action: "getSessionUserDevMode",
          result: "failure",
        }, "Failed to create dev session");
      }
    }
  }

  try {
    const extensionSessionToken = await getExtensionSessionTokenFromHeaders();
    if (extensionSessionToken) {
      const extensionSessionState = await getSessionUserFromExtensionToken(
        extensionSessionToken,
      );

      // Keep extension-token auth as the primary path, but do not hard-fail
      // on stale/expired tokens when a valid web session cookie is present.
      if (extensionSessionState.status !== "unauthenticated") {
        return extensionSessionState;
      }
    }

    if (isCloudflareRuntime()) {
      return getCloudflareSessionUser();
    }

    const { data: session, error } = await auth.getSession();
    if (error || !session?.user) {
      return { status: "unauthenticated", user: null, email: null };
    }

    return resolveSessionStateFromAuthUser(session.user);
  } catch {
    return { status: "unauthenticated", user: null, email: null };
  }
}

export async function requireAuth() {
  const state = await getSessionUser();
  if (state.status === "unauthenticated") redirect("/auth/sign-in");
  if (state.status === "forbidden") redirect("/auth/denied");
  if (state.status === "inactive") redirect("/auth/denied?reason=inactive");
  return state.user;
}

export async function requireAdmin() {
  const state = await getSessionUser();
  if (state.status === "unauthenticated") redirect("/admin/auth");
  if (state.status !== "ok") {
    redirect("/auth/denied?reason=not-admin");
  }
  if (isCloudflareRuntime()) {
    const capabilities = resolveAdminCapabilities(state.user.role, []);
    if (!canAccessAdminPanel(state.user.role, capabilities)) {
      redirect("/auth/denied?reason=not-admin");
    }
    return state.user;
  }
  const capabilities = resolveAdminCapabilities(
    state.user.role,
    await prisma.adminUserCapability.findMany({
      where: { userId: state.user.id },
      select: { capability: true, enabled: true },
    }),
  );
  if (!canAccessAdminPanel(state.user.role, capabilities)) {
    redirect("/auth/denied?reason=not-admin");
  }
  return state.user;
}

export async function canSignUpWithEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isCloudflareRuntime()) return canSignUpWithCloudflareEmail(normalized);
  if (isAllowedEmail(normalized)) return true;
  return hasPendingInvite(normalized);
}

export async function canSignInWithEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: "Completa correo." };
  if (isCloudflareRuntime()) return canSignInWithCloudflareEmail(normalized);

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { isActive: true },
  });

  if (existing && !existing.isActive) {
    return { ok: false, error: "Tu usuario está desactivado." };
  }

  if (isAllowedEmail(normalized) || existing) {
    return { ok: true as const };
  }

  const pending = await hasPendingInvite(normalized);
  if (pending) return { ok: true as const };

  const invitedBefore = await hasInviteHistory(normalized);
  if (invitedBefore) return { ok: true as const };

  return {
    ok: false,
    error:
      "Correo no autorizado. Necesitas invitación o dominio @unidep.edu.mx.",
  };
}
