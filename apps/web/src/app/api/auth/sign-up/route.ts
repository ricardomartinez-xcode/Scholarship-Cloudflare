import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { canSignUpWithEmail } from "@/lib/authz";

export const dynamic = "force-dynamic";

const buildErrorUrl = (message: string, token?: string) => {
  const base = `/auth/sign-up?error=${encodeURIComponent(message)}`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
};

function safeCallbackPath(value: FormDataEntryValue | null, token: string) {
  const fallback = token ? `/invite/accept?token=${encodeURIComponent(token)}` : "/unidep";
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  try {
    const url = new URL(raw, "https://recalc.local");
    if (url.origin !== "https://recalc.local") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

function buildInviteSignInUrl(params: {
  token?: string;
  email: string;
  success?: string;
  error?: string;
}) {
  const search = new URLSearchParams({ email: params.email });

  if (params.token) {
    search.set("fromInvite", "1");
    search.set("next", `/invite/accept?token=${params.token}`);
  }
  if (params.success) search.set("success", params.success);
  if (params.error) search.set("error", params.error);

  return `/auth/sign-in?${search.toString()}`;
}

function isExistingAccountError(message: string) {
  return /already|exist|registered|duplicate|user already|account.*found|email.*taken|correo.*registrado|cuenta.*existe/i.test(
    message,
  );
}

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "").trim();
  const callbackPath = safeCallbackPath(formData.get("callbackURL"), token);

  if (!email || !password) {
    return redirect(request, buildErrorUrl("Completa correo y contraseña.", token));
  }

  if (!(await canSignUpWithEmail(email))) {
    return redirect(
      request,
      buildErrorUrl(
        "Correo no autorizado. Necesitas invitación o dominio @unidep.edu.mx.",
        token,
      ),
    );
  }

  const name = email.split("@")[0] || "Usuario";
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", callbackPath);

  const result = await auth.signUp.email({
    email,
    name,
    password,
    callbackURL: callbackUrl.toString(),
  });

  if (result?.error) {
    const message = result.error.message ?? "No fue posible crear la cuenta.";
    if (isExistingAccountError(message)) {
      return redirect(
        request,
        buildInviteSignInUrl({
          token,
          email,
          error: token
            ? "Ya existe una cuenta con este correo. Inicia sesión para aceptar la invitación."
            : "Ya existe una cuenta con este correo. Inicia sesión para continuar.",
        }),
      );
    }

    return redirect(request, buildErrorUrl(message, token));
  }

  const success =
    "Cuenta creada. Revisa tu correo para confirmar la cuenta y después inicia sesión.";

  return redirect(
    request,
    buildInviteSignInUrl({
      token,
      email,
      success,
    }),
  );
}
