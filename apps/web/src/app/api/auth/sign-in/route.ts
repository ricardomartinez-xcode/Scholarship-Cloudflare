import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { canSignInWithEmail } from "@/lib/authz";
import { getD1 } from "@/lib/cloudflare/d1";
import {
  setCloudflareSessionCookie,
  signInWithCloudflare,
} from "@/lib/cloudflare/auth";
import { isCloudflareRuntime } from "@/lib/cloudflare/runtime";
import {
  checkCloudflareLoginRateLimit,
  consumeCloudflareLoginFailure,
} from "@/lib/d1/auth-rate-limit";
import { captureException } from "@/lib/observability";

export const dynamic = "force-dynamic";

const buildErrorUrl = (message: string, extra: Record<string, string> = {}) => {
  const qs = new URLSearchParams({ error: message, ...extra });
  return `/auth/sign-in?${qs.toString()}`;
};

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp.slice(0, 128);

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor ? forwardedFor.slice(0, 128) : "unknown-ip";
}

function rateLimitedResponse(
  request: Request,
  inviteParams: Record<string, string>,
  retryAfterSeconds: number,
) {
  const response = redirect(
    request,
    buildErrorUrl(
      "Demasiados intentos. Intenta de nuevo más tarde.",
      inviteParams,
    ),
  );
  response.headers.set("Retry-After", String(Math.max(1, retryAfterSeconds)));
  return response;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "").trim();
    const fromInvite = String(formData.get("fromInvite") ?? "");
    const inviteParams: Record<string, string> = {
      ...(fromInvite ? { fromInvite } : {}),
      ...(next.startsWith("/") ? { next } : {}),
      ...(email ? { email } : {}),
    };

    if (!email || !password) {
      return redirect(request, buildErrorUrl("Completa correo y contraseña.", inviteParams));
    }

    if (isCloudflareRuntime()) {
      const db = getD1();
      const preflight = await checkCloudflareLoginRateLimit(db, {
        email,
        ip: getClientIp(request),
      });
      if (!preflight.allowed) {
        return rateLimitedResponse(request, inviteParams, preflight.retryAfterSeconds);
      }

      const result = await signInWithCloudflare({ email, password });
      if (!result.ok) {
        const failure = await consumeCloudflareLoginFailure(db, {
          email,
          ip: getClientIp(request),
        });
        if (!failure.allowed) {
          return rateLimitedResponse(request, inviteParams, failure.retryAfterSeconds);
        }
        return redirect(
          request,
          buildErrorUrl("Correo o contraseña incorrectos.", inviteParams),
        );
      }

      const response = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/unidep", request.url), {
        status: 303,
      });
      setCloudflareSessionCookie(response, result.token, result.expiresAt);
      return response;
    }

    const signInPolicy = await canSignInWithEmail(email);
    if (!signInPolicy.ok) {
      return redirect(request, buildErrorUrl(signInPolicy.error, inviteParams));
    }

    const result = await auth.signIn.email({ email, password });
    if (result?.error) {
      const message = result.error.message ?? "No fue posible iniciar sesión.";
      if (/not verified/i.test(message)) {
        return redirect(
          request,
          buildErrorUrl(
            "Correo no verificado. Revisa tu bandeja de entrada y confirma tu cuenta antes de continuar.",
            inviteParams,
          ),
        );
      }

      return redirect(request, buildErrorUrl(message, inviteParams));
    }

    if (next.startsWith("/")) {
      return redirect(request, next);
    }

    return redirect(request, "/unidep");
  } catch (error) {
    captureException(
      error,
      { module: "auth", action: "publicSignIn", result: "failure" },
      "Failed to process public sign-in request",
    );
    return redirect(
      request,
      buildErrorUrl("No fue posible iniciar sesión. Intenta de nuevo."),
    );
  }
}
