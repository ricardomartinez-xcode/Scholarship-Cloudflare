import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import {
  canSignInWithEmail,
  resolveSessionStateFromAuthUser,
} from "@/lib/authz";
import { captureException } from "@/lib/observability";
import { issueExtensionSessionToken } from "@/lib/extension-session-tokens";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DEFAULT_SUCCESS_PATH = "/extension";
const DEFAULT_FAILURE_PATH = "/extension/auth/sign-in";

type SignInPayload = {
  email?: string;
  password?: string;
  next?: string;
  ttlMs?: number | string | null;
  sessionDuration?: string | null;
  tokenDuration?: string | null;
  extensionSessionDuration?: string | null;
};

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

async function readJsonPayload(request: Request): Promise<SignInPayload | null> {
  try {
    return (await request.json()) as SignInPayload;
  } catch {
    return null;
  }
}

function readRequestedSessionTtl(payload: SignInPayload | null) {
  const rawTtlMs = payload?.ttlMs;
  const ttlMs =
    typeof rawTtlMs === "number"
      ? rawTtlMs
      : typeof rawTtlMs === "string"
        ? Number(rawTtlMs)
        : null;

  const ttlPreset =
    [
      payload?.sessionDuration,
      payload?.tokenDuration,
      payload?.extensionSessionDuration,
    ]
      .map((value) => String(value ?? "").trim())
      .find(Boolean) ?? null;

  return { ttlMs, ttlPreset };
}

function statusCodeForSessionState(
  status: "unauthenticated" | "forbidden" | "inactive" | "ok",
) {
  if (status === "ok") return 200;
  if (status === "unauthenticated") return 401;
  return 403;
}

function jsonSignInFailure(error: string, status: number, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(code ? { code } : {}),
    },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const jsonMode = isJsonRequest(request);
    const jsonPayload = jsonMode ? await readJsonPayload(request) : null;
    const formData = jsonMode ? null : await request.formData();
    const email = String(
      (jsonPayload?.email ?? formData?.get("email")) ?? "",
    )
      .trim()
      .toLowerCase();
    const password = String(
      (jsonPayload?.password ?? formData?.get("password")) ?? "",
    );
    const next = String(
      (jsonPayload?.next ?? formData?.get("next")) ?? "",
    ).trim();

    if (!email || !password) {
      if (jsonMode) {
        return jsonSignInFailure(
          "Completa correo y contraseña.",
          400,
          "missing_credentials",
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
          {
            ok: false,
            error: "rate_limited",
            message,
            retryAfterMs: limiter.retryAfterMs,
          },
          { status: 429 },
        );
      }
      return redirect(request, buildErrorUrl(message, { email }));
    }

    const signInPolicy = await canSignInWithEmail(email);
    if (!signInPolicy.ok) {
      if (jsonMode) {
        return jsonSignInFailure(signInPolicy.error, 403, "sign_in_not_allowed");
      }
      return redirect(request, buildErrorUrl(signInPolicy.error, { email }));
    }

    if (jsonMode) {
      const signIn = await auth.signIn.email({ email, password });
      if (signIn.error || !signIn.data.user) {
        return jsonSignInFailure(
          signIn.error?.message ?? "Credenciales invalidas.",
          401,
          "invalid_credentials",
        );
      }

      const resolvedSession = await resolveSessionStateFromAuthUser(
        signIn.data.user,
      );
      if (resolvedSession.status !== "ok") {
        await auth.signOut().catch(() => undefined);
        return jsonSignInFailure(
          resolvedSession.status,
          statusCodeForSessionState(resolvedSession.status),
          `session_${resolvedSession.status}`,
        );
      }

      const requestedSessionTtl = readRequestedSessionTtl(jsonPayload);
      const issuedToken = await issueExtensionSessionToken({
        userId: resolvedSession.user.id,
        client:
          request.headers.get("x-extension-client") ?? "chrome-sidepanel",
        extensionVersion: request.headers.get("x-extension-version"),
        userAgent: request.headers.get("user-agent"),
        scope: "extension:chrome-sidepanel",
        ttlMs: requestedSessionTtl.ttlMs,
        ttlPreset: requestedSessionTtl.ttlPreset,
      });

      // The extension receives only its scoped internal token, never Supabase cookies.
      await auth.signOut().catch(() => undefined);

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

    return redirect(
      request,
      next.startsWith("/") ? next : DEFAULT_SUCCESS_PATH,
    );
  } catch (error) {
    captureException(
      error,
      { module: "auth", action: "extensionSignIn", result: "failure" },
      "Failed to process extension sign-in request",
    );

    if (isJsonRequest(request)) {
      return jsonSignInFailure(
        "No fue posible iniciar sesión.",
        500,
        "sign_in_failed",
      );
    }

    return redirect(request, buildErrorUrl("No fue posible iniciar sesión."));
  }
}
