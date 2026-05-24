import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { listCampusCatalog } from "@/lib/campus-resolver";
import { loadCanonicalReturnSubjectPayload } from "@/lib/canonical-pricing-readers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getSessionUser();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.status === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (auth.status === "inactive") {
    return NextResponse.json({ error: "inactive" }, { status: 403 });
  }

  try {
    const campuses = await listCampusCatalog();
    const canonical = await loadCanonicalReturnSubjectPayload(campuses);
    return NextResponse.json(canonical);
  } catch {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
