import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import {
  deleteUserPushSubscription,
  getWebPushClientConfig,
  saveUserPushSubscription,
  type PushSubscriptionInput,
} from "@/lib/web-push";

export async function GET() {
  const session = await getSessionUser();
  if (session.status !== "ok" || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getWebPushClientConfig();
  return NextResponse.json({
    ok: true,
    configured: config.configured,
    publicKey: config.publicKey,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (session.status !== "ok" || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getWebPushClientConfig();
  if (!config.configured || !config.publicKey) {
    return NextResponse.json(
      { error: "Web Push no está configurado." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      subscription?: {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: { p256dh?: string; auth?: string };
      };
    };
    const subscription = body.subscription;

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: "La suscripción push del navegador está incompleta." },
        { status: 400 },
      );
    }

    const normalizedSubscription: PushSubscriptionInput = {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    await saveUserPushSubscription(
      session.user.id,
      normalizedSubscription,
      request.headers.get("user-agent"),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar la suscripción push.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionUser();
  if (session.status !== "ok" || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | { endpoint?: string }
      | null;

    await deleteUserPushSubscription(
      session.user.id,
      String(body?.endpoint ?? ""),
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No fue posible eliminar la suscripción push." },
      { status: 400 },
    );
  }
}
