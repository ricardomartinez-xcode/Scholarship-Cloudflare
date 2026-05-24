import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_TYPES } from "@/lib/pricing-normalize";

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

  const [rules, campuses, subjectPrices] = await Promise.all([
    prisma.scholarshipRule.findMany({
      where: { sourceVersion: "canonical" },
      distinct: ["businessLine", "modality", "plan"],
      orderBy: [
        { businessLine: "asc" },
        { modality: "asc" },
        { plan: "asc" },
      ],
      select: {
        businessLine: true,
        modality: true,
        plan: true,
      },
    }),
    prisma.campus.findMany({
      where: { isActive: true, code: { not: "ONLINE" } },
      orderBy: [{ name: "asc" }],
      select: { code: true, metaKey: true, name: true },
    }),
    prisma.returnSubjectPrice.findMany({
      where: { sourceVersion: "canonical" },
      distinct: ["subjectCount"],
      orderBy: [{ subjectCount: "asc" }],
      select: { subjectCount: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    combinations: ENROLLMENT_TYPES.flatMap((enrollmentType) =>
      rules.map((rule) => ({
        enrollmentType,
        businessLine: rule.businessLine,
        modality: rule.modality,
        plan: rule.plan,
      })),
    ),
    campuses: campuses.map((campus) => ({
      value: campus.metaKey || campus.code || campus.name,
      label: campus.name,
    })),
    subjectCounts: subjectPrices.map((row) => row.subjectCount),
  });
}
