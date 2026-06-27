import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminAccessApiUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const authResult = await getAdminAccessApiUser(requestId);
    if (!authResult.ok) return authResult.response;

    revalidatePath("/", "layout");

    return NextResponse.json({
      ok: true,
      requestId,
      revalidatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible aplicar la revalidación.",
        requestId,
      },
      { status: 500 },
    );
  }
}
