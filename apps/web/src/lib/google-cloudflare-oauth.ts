import { getD1 } from "@/lib/cloudflare/d1";
import { writeAuditEvent } from "@/lib/d1/audit";
import { D1DomainError } from "@/lib/d1/errors";
import {
  createGoogleOAuthState,
  consumeGoogleOAuthState,
  purgeExpiredGoogleOAuthStates,
  toPkceChallenge,
} from "@/lib/d1/google-oauth-state";
import {
  readGoogleTokensForSubject,
  saveGoogleConnection,
} from "@/lib/d1/google-oauth";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

const GOOGLE_RESOURCES = ["drive", "sheets", "calendar"] as const;
type GoogleResource = (typeof GOOGLE_RESOURCES)[number];

const GOOGLE_RESOURCE_SCOPES: Record<GoogleResource, string> = {
  drive: "https://www.googleapis.com/auth/drive.file",
  sheets: "https://www.googleapis.com/auth/spreadsheets",
  calendar: "https://www.googleapis.com/auth/calendar.events",
};

const GOOGLE_IDENTITY_SCOPES = ["openid", "email", "profile"];

export type GoogleOAuthConfiguration =
  | {
      configured: false;
      missing: string[];
    }
  | {
      configured: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      encryptionKey: string;
      keyVersion: string;
    };

type OrganizationAccess = {
  id: string;
  slug: string;
  name: string;
  role: "owner" | "admin";
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

export function getGoogleOAuthConfiguration(): GoogleOAuthConfiguration {
  const clientId = readEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = readEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const encryptionKey = readEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const missing = [
    !clientId ? "GOOGLE_OAUTH_CLIENT_ID" : null,
    !clientSecret ? "GOOGLE_OAUTH_CLIENT_SECRET" : null,
    !redirectUri ? "GOOGLE_OAUTH_REDIRECT_URI" : null,
    !encryptionKey ? "GOOGLE_TOKEN_ENCRYPTION_KEY" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length) return { configured: false, missing };
  return {
    configured: true,
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    encryptionKey: encryptionKey!,
    keyVersion: readEnv("GOOGLE_TOKEN_ENCRYPTION_KEY_VERSION") ?? "v1",
  };
}

function safeReturnTo(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/admin";
  }

  const parsed = new URL(raw, "https://recalc.local");
  if (parsed.origin !== "https://recalc.local") return "/admin";
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function withGoogleOAuthStatus(returnTo: string, status: string): string {
  const parsed = new URL(safeReturnTo(returnTo), "https://recalc.local");
  parsed.searchParams.set("google", status);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function parseResources(raw: string | null | undefined): GoogleResource[] {
  const values = (raw?.trim() || GOOGLE_RESOURCES.join(","))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const resources = Array.from(new Set(values));
  const invalid = resources.filter(
    (resource) => !(GOOGLE_RESOURCES as readonly string[]).includes(resource),
  );
  if (invalid.length || !resources.length) {
    throw new D1DomainError(
      "Google resources are invalid",
      "invalid_google_resources",
      400,
    );
  }
  return resources as GoogleResource[];
}

function scopesForResources(resources: GoogleResource[]): string[] {
  return Array.from(
    new Set([
      ...GOOGLE_IDENTITY_SCOPES,
      ...resources.map((resource) => GOOGLE_RESOURCE_SCOPES[resource]),
    ]),
  );
}

async function resolveOrganizationAccess(
  userId: string,
  requestedOrganizationId?: string | null,
): Promise<OrganizationAccess> {
  const db = getD1();
  const requested = requestedOrganizationId?.trim() || null;

  if (requested) {
    const row = await db
      .prepare(
        `SELECT o.id, o.slug, o.name, m.role
         FROM organization o
         INNER JOIN organization_member m ON m.organization_id = o.id
         WHERE o.id = ?
           AND o.status = 'active'
           AND m.user_id = ?
           AND m.status = 'active'
           AND m.role IN ('owner', 'admin')
         LIMIT 1`,
      )
      .bind(requested, userId)
      .first<OrganizationAccess>();

    if (!row) {
      throw new D1DomainError(
        "Organization access is required for Google OAuth",
        "organization_access_required",
        403,
      );
    }
    return row;
  }

  const rows = await db
    .prepare(
      `SELECT o.id, o.slug, o.name, m.role
       FROM organization o
       INNER JOIN organization_member m ON m.organization_id = o.id
       WHERE o.status = 'active'
         AND m.user_id = ?
         AND m.status = 'active'
         AND m.role IN ('owner', 'admin')
       ORDER BY o.created_at DESC
       LIMIT 2`,
    )
    .bind(userId)
    .all<OrganizationAccess>();

  const organizations = rows.results ?? [];
  if (organizations.length === 1) return organizations[0];
  if (organizations.length > 1) {
    throw new D1DomainError(
      "An organization must be selected",
      "organization_required",
      400,
    );
  }
  throw new D1DomainError(
    "Organization access is required for Google OAuth",
    "organization_access_required",
    403,
  );
}

type GoogleTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

type GoogleUserInfo = {
  sub?: unknown;
  email?: unknown;
};

async function exchangeAuthorizationCode(
  config: Extract<GoogleOAuthConfiguration, { configured: true }>,
  input: { code: string; codeVerifier: string },
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
}> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as GoogleTokenResponse | null;

  if (!response.ok || typeof payload?.access_token !== "string" || !payload.access_token) {
    throw new D1DomainError(
      "Google authorization code exchange failed",
      "google_token_exchange_failed",
      502,
    );
  }

  const expiresIn = Number(payload.expires_in);
  return {
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === "string" && payload.refresh_token
        ? payload.refresh_token
        : null,
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
    scopes:
      typeof payload.scope === "string"
        ? payload.scope.split(/\s+/u).filter(Boolean)
        : [],
  };
}

async function getGoogleUserInfo(accessToken: string): Promise<{
  subject: string;
  email: string | null;
}> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as GoogleUserInfo | null;

  if (!response.ok || typeof payload?.sub !== "string" || !payload.sub) {
    throw new D1DomainError(
      "Google identity verification failed",
      "google_userinfo_failed",
      502,
    );
  }

  return {
    subject: payload.sub,
    email: typeof payload.email === "string" && payload.email ? payload.email : null,
  };
}

export async function beginGoogleOAuth(input: {
  userId: string;
  organizationId?: string | null;
  resources?: string | null;
  returnTo?: string | null;
  config: Extract<GoogleOAuthConfiguration, { configured: true }>;
}): Promise<{ authorizationUrl: string; organization: OrganizationAccess }> {
  const db = getD1();
  const organization = await resolveOrganizationAccess(input.userId, input.organizationId);
  const resources = parseResources(input.resources);
  const scopes = scopesForResources(resources);
  const returnTo = safeReturnTo(input.returnTo);

  await purgeExpiredGoogleOAuthStates(db);
  const state = await createGoogleOAuthState(db, {
    organizationId: organization.id,
    userId: input.userId,
    scopes,
    returnTo,
    encryptionKey: input.config.encryptionKey,
    keyVersion: input.config.keyVersion,
  });

  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("client_id", input.config.clientId);
  authorizationUrl.searchParams.set("code_challenge", await toPkceChallenge(state.codeVerifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("include_granted_scopes", "true");
  authorizationUrl.searchParams.set("prompt", "consent");
  authorizationUrl.searchParams.set("redirect_uri", input.config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", state.scopes.join(" "));
  authorizationUrl.searchParams.set("state", state.state);

  return { authorizationUrl: authorizationUrl.toString(), organization };
}

export async function completeGoogleOAuth(input: {
  userId: string;
  state: string;
  code: string;
  requestId: string;
  config: Extract<GoogleOAuthConfiguration, { configured: true }>;
}): Promise<{
  returnTo: string;
  connectionId: string;
  organization: OrganizationAccess;
}> {
  const db = getD1();
  const state = await consumeGoogleOAuthState(db, {
    state: input.state,
    userId: input.userId,
    encryptionKey: input.config.encryptionKey,
  });
  const organization = await resolveOrganizationAccess(input.userId, state.organizationId);
  const tokens = await exchangeAuthorizationCode(input.config, {
    code: input.code,
    codeVerifier: state.codeVerifier,
  });
  const identity = await getGoogleUserInfo(tokens.accessToken);

  const existing = tokens.refreshToken
    ? null
    : await readGoogleTokensForSubject(db, {
        organizationId: organization.id,
        providerSubject: identity.subject,
        encryptionKey: input.config.encryptionKey,
      });
  const refreshToken = tokens.refreshToken ?? existing?.refreshToken ?? null;

  if (!refreshToken) {
    throw new D1DomainError(
      "Google did not provide a refresh token",
      "google_refresh_token_missing",
      422,
    );
  }

  const scopes = tokens.scopes.length ? tokens.scopes : state.scopes;
  const connectionId = await saveGoogleConnection(db, {
    organizationId: organization.id,
    userId: input.userId,
    providerSubject: identity.subject,
    providerEmail: identity.email,
    scopes,
    refreshToken,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.expiresAt,
    encryptionKey: input.config.encryptionKey,
    keyVersion: input.config.keyVersion,
    metadata: {
      returnTo: state.returnTo,
      resources: scopes
        .filter((scope) => Object.values(GOOGLE_RESOURCE_SCOPES).includes(scope))
        .sort(),
    },
  });

  await writeAuditEvent(db, {
    organizationId: organization.id,
    actorUserId: input.userId,
    action: "google.oauth_connected",
    resourceType: "oauth_connection",
    resourceId: connectionId,
    requestId: input.requestId,
    metadata: {
      provider: "google",
      providerEmail: identity.email,
      scopes,
    },
  });

  return { returnTo: state.returnTo, connectionId, organization };
}

export async function cancelGoogleOAuth(input: {
  userId: string;
  state: string;
  config: Extract<GoogleOAuthConfiguration, { configured: true }>;
}): Promise<{ returnTo: string }> {
  const consumed = await consumeGoogleOAuthState(getD1(), {
    state: input.state,
    userId: input.userId,
    encryptionKey: input.config.encryptionKey,
  });
  return { returnTo: consumed.returnTo };
}
