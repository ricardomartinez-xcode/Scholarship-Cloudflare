import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { sendPushNotificationToUsers } from "@/lib/web-push";

export async function POST() {
  const session = await getSessionUser();
  if (session.status !== "ok" || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendPushNotificationToUsers([session.user.id], {
      title: "ReCalc",
      body: "Esta es una notificación push de prueba para validar tu navegador.",
      url: "/unidep/inbox",
      tag: `inbox:test:${session.user.id}`,
    });

    if (result.skipped) {
      return NextResponse.json(
        { error: "Web Push no está configurado en el servidor." },
        { status: 503 },
      );
    }

    if (result.delivered === 0) {
      return NextResponse.json(
        {
          error:
            "No hay una suscripción activa para este usuario en este navegador. Activa o sincroniza las alertas primero.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      removed: result.removed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible enviar la notificación de prueba.",
      },
      { status: 500 },
    );
  }
}
