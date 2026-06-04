import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { canSignInWithEmail, resolveSessionStateFromAuthUser } from "@/lib/authz";
import { captureException } from "@/lib/observability";
import {
  getExtensionAuthSession,
  revokeExtensionAuthSession,
  signInExtensionAuthSession,
} from "@/lib/extension-auth";
import { issueExtensionSessionToken } from "@/lib/extension-session-tokens";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DEFAULT_SUCCESS_PATH = "/extension";
const DEFAULT_FAILURE_PATH = "/extension/auth/sign-in";

const buildErrorUrl = (message: string, extra: Record<string, string> = {}) => {
  const qs = new URLSearchParams({ error: message, ...extra });
  return `${DEFAULT_FAILURE_PATH}?${qs.toString()}`;
};

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

function isJsonRequest(request: Request) {
  return request.headers.get("content-type")?.includes("application/json") ?? false;
}

async function readJsonPayload(request: Request) {
  try {
    return (await request.json()) as {
      email?: string;
      password?: string;
      next?: string;
      ttlMs?: number | string | null;
      sessionDuration?: string | null;
      tokenDuration?: string | null;
      extensionSessionDuration?: string | null;
    };
  } catch {
    return null;
  }
}

function readRequestedSessionTtl(jsonPayload: Awaited<ReturnType<typeof readJsonPayload>>) {
  const rawTtlMs = jsonPayload?.ttlMs;
  const ttlMs =
    typeof rawTtlMs === "number"
      ? rawTtlMs
      : typeof rawTtlMs === "string"
        ? Number(rawTtlMs)
        : null;

  const ttlPreset =
    [
      jsonPayload?.sessionDuration,
      jsonPayload?.tokenDuration,
      jsonPayload?.extensionSessionDuration,
    ]
      .map((value) => String(value ?? "").trim())
      .find(Boolean) ?? null;

  return { ttlMs, ttlPreset };
}

export async function POST(request: Request) {
  try {
    const jsonMode = isJsonRequest(request);
    const jsonPayload = jsonMode ? await readJsonPayload(request) : null;
    const formData = jsonMode ? null : await request.formData();
    const email = String((jsonPayload?.email ?? formData?.get("email")) ?? "")
      .trim()
      .toLowerCase();
    const password = String((jsonPayload?.password ?? formData?.get("password")) ?? "");
    const next = String((jsonPayload?.next ?? formData?.get("next")) ?? "").trim();

    if (!email || !password) {
      if (jsonMode) {
        return NextResponse.json(
          { ok: false, error: "Completa correo y contraseña." },
          { status: 400 },
        );
      }
      return redirect(request, buildErrorUrl("Completa correo y contraseña."));
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip =
      forwardedFor?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const limiter = await checkRateLimit(`extension-signin:${ip}:${email}`, {
      limit: 5,
      windowMs: 10 * 60_000,
    });
    if (!limiter.ok) {
      const message = "Demasiados intentos. Intenta de nuevo en unos minutos.";
      if (jsonMode) {
        return NextResponse.json(
          { ok: false, error: "rate_limited", message, retryAfterMs: limiter.retryAfterMs },
          { status: 429 },
        );
      }
      return redirect(request, buildErrorUrl(message, { email }));
    }

    const signInPolicy = await canSignInWithEmail(email);
    if (!signInPolicy.ok) {
      if (jsonMode) {
        return NextResponse.json(
          { ok: false, error: signInPolicy.error },
          { status: 403 },
        );
      }
      return redirect(request, buildErrorUrl(signInPolicy.error, { email }));
    }

    if (jsonMode) {
      const origin = new URL(request.url).origin;
      const extensionSignIn = await signInExtensionAuthSession({
        email,
        password,
        origin,
      });

      if (!extensionSignIn.ok) {
        return NextResponse.json(
          { ok: false, error: extensionSignIn.error },
          { status: 401 },
        );
      }

      const upstreamSession = await getExtensionAuthSession(extensionSignIn.sessionToken);
      const resolvedSession = await resolveSessionStateFromAuthUser(upstreamSession?.user);
      if (resolvedSession.status !== "ok") {
        await revokeExtensionAuthSession(extensionSignIn.sessionToken).catch(() => false);
        return NextResponse.json(
          { ok: false, error: resolvedSession.status },
          { status: resolvedSession.status === "unauthenticated" ? 401 : 403 },
        );
      }

      const requestedSessionTtl = readRequestedSessionTtl(jsonPayload);
      const issuedToken = await issueExtensionSessionToken({
        userId: resolvedSession.user.id,
        client: request.headers.get("x-extension-client") ?? "chrome-sidepanel",
        extensionVersion: request.headers.get("x-extension-version"),
        userAgent: request.headers.get("user-agent"),
        scope: "extension:chrome-sidepanel",
        ttlMs: requestedSessionTtl.ttlMs,
        ttlPreset: requestedSessionTtl.ttlPreset,
      });

      // Do not keep a full Neon Auth session token in the extension.
      await revokeExtensionAuthSession(extensionSignIn.sessionToken).catch(() => false);

      return NextResponse.json({
        ok: true,
        email,
        next: next.startsWith("/") ? next : DEFAULT_SUCCESS_PATH,
        extensionSessionToken: issuedToken.token,
        expiresAt: issuedToken.expiresAt.toISOString(),
        sessionDuration: issuedToken.ttlPreset,
        sessionTtlMs: issuedToken.ttlMs,
      });
    }

    const result = await auth.signIn.email({ email, password });
    if (result?.error) {
      const message = result.error.message ?? "No fue posible iniciar sesión.";
      if (/not verified/i.test(message)) {
        return redirect(
          request,
          buildErrorUrl(
            "Correo no verificado. Revisa tu bandeja de entrada y confirma tu cuenta antes de continuar.",
            { email },
          ),
        );
      }

      return redirect(request, buildErrorUrl(message, { email }));
    }

    if (jsonMode) {
      return NextResponse.json({
        ok: true,
        email,
        next: next.startsWith("/") ? next : DEFAULT_SUCCESS_PATH,
      });
    }

    if (next.startsWith("/")) {
      return redirect(request, next);
    }

    return redirect(request, DEFAULT_SUCCESS_PATH);
  } catch (error) {
    captureException(
      error,
      { module: "auth", action: "extensionSignIn", result: "failure" },
      "Failed to process extension sign-in request",
    );

    if (isJsonRequest(request)) {
      return NextResponse.json(
        { ok: false, error: "No fue posible iniciar sesión." },
        { status: 500 },
      );
    }

    return redirect(request, buildErrorUrl("No fue posible iniciar sesión."));
  }
}
