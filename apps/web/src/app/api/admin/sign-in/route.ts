import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { captureException } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const buildErrorUrl = (message: string) =>
  `/admin/auth?error=${encodeURIComponent(message)}`;

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip =
      forwardedFor?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const rl = await checkRateLimit(`admin-signin:${ip}`, { limit: 5, windowMs: 60_000 });
    if (!rl.ok) {
      return redirect(request, buildErrorUrl("Demasiados intentos. Intenta en 1 minuto."));
    }

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return redirect(request, buildErrorUrl("Completa correo y contraseña."));
    }

    const result = await auth.signIn.email({ email, password });
    if (result?.error) {
      return redirect(request, buildErrorUrl("Credenciales incorrectas."));
    }

    return redirect(request, "/admin");
  } catch (error) {
    captureException(
      error,
      { module: "auth", action: "adminSignIn", result: "failure" },
      "Failed to process admin sign-in request",
    );
    return redirect(request, buildErrorUrl("No fue posible iniciar sesión."));
  }
}
