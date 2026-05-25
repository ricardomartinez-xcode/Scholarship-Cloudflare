import { NextResponse } from "next/server";

import { consumeInviteToken } from "@/lib/invites";
import { getSessionUser } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";

const getClientIp = (request: Request) =>
  (request.headers.get("x-forwarded-for") ?? "")
    .split(",")[0]
    ?.trim() || "unknown";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limiter = await checkRateLimit(`invite:accept:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
      },
      { status: 429 }
    );
  }

  const state = await getSessionUser();
  if (state.status === "unauthenticated") {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión." },
      { status: 401 }
    );
  }
  if (state.status !== "ok") {
    return NextResponse.json(
      { ok: false, error: "No tienes autorización para aceptar invitaciones." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as { token?: string };
  const token = String(body?.token ?? "").trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token inválido." },
      { status: 400 }
    );
  }
  if (!state.user.authUserId) {
    return NextResponse.json(
      { ok: false, error: "Sesión inválida." },
      { status: 400 }
    );
  }

  try {
    const result = await consumeInviteToken({
      token,
      authUserId: state.user.authUserId,
      email: state.email,
    });
    return NextResponse.json({
      ok: true,
      alreadyUsed: result.alreadyUsed,
      role: result.user.role,
      email: result.user.email,
      message: result.alreadyUsed
        ? "La invitación ya estaba aceptada para este correo."
        : "Invitación aceptada correctamente.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No fue posible aceptar la invitación.";
    const code =
      (err as { code?: string }).code ?? "INVITE_ACCEPT_FAILED";
    const status =
      code === "INVITE_NOT_FOUND"
        ? 404
        : code === "INVITE_EXPIRED"
          ? 410
          : code === "INVITE_CANCELLED"
            ? 409
            : code === "WRONG_EMAIL"
              ? 422
              : 400;
    return NextResponse.json({ ok: false, error: message, code }, { status });
  }
}
