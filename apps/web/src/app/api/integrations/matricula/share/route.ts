import { NextResponse } from "next/server";

import {
  isMatriculaSharingEnabled,
  shareMatriculaFromScholarship,
  type ShareMatriculaPayload,
} from "@/lib/integrations/matricula";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function buildSharePayload(payload: JsonRecord, matricula: string): ShareMatriculaPayload {
  const student = isRecord(payload.student)
    ? {
        firstName: readString(payload.student.firstName),
        lastName: readString(payload.student.lastName),
        fullName: readString(payload.student.fullName),
        email: readString(payload.student.email),
        phone: readString(payload.student.phone),
        externalId: readString(payload.student.externalId),
      }
    : undefined;
  const academic = isRecord(payload.academic)
    ? {
        campus: readString(payload.academic.campus),
        campusCode: readString(payload.academic.campusCode),
        program: readString(payload.academic.program),
        programCode: readString(payload.academic.programCode),
        modality: readString(payload.academic.modality),
        plan: readString(payload.academic.plan) ?? readNumber(payload.academic.plan),
        cycle: readString(payload.academic.cycle),
        businessLine: readString(payload.academic.businessLine),
      }
    : undefined;
  const scholarship = isRecord(payload.scholarship)
    ? {
        average: readNumber(payload.scholarship.average),
        scholarshipPercent: readNumber(payload.scholarship.scholarshipPercent),
        enrollmentType: readString(payload.scholarship.enrollmentType),
        subjectCount: readNumber(payload.scholarship.subjectCount),
        quoteId: readString(payload.scholarship.quoteId),
        quoteTotal: readNumber(payload.scholarship.quoteTotal),
      }
    : undefined;
  const metadata = isRecord(payload.metadata) ? payload.metadata : undefined;

  return {
    matricula,
    student,
    academic,
    scholarship,
    metadata,
  };
}

function buildIdempotencyKey(payload: JsonRecord, matricula: string) {
  const explicit = readString(payload.idempotencyKey, 180);
  if (explicit) return explicit;

  const sourceRecordId = isRecord(payload.metadata) ? readString(payload.metadata.sourceRecordId, 120) : undefined;
  return sourceRecordId ? `scholarship:${sourceRecordId}:${matricula}` : `scholarship:${matricula}`;
}

export async function POST(request: Request) {
  if (!isMatriculaSharingEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "La integración de matrícula no está configurada.",
      },
      { status: 503 },
    );
  }

  const payload = await request.json().catch(() => null);

  if (!isRecord(payload)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Payload inválido para compartir matrícula.",
      },
      { status: 400 },
    );
  }

  const matricula = readString(payload.matricula, 80);

  if (!matricula) {
    return NextResponse.json(
      {
        ok: false,
        error: "Matrícula requerida.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await shareMatriculaFromScholarship(buildSharePayload(payload, matricula), {
      idempotencyKey: buildIdempotencyKey(payload, matricula),
      dryRun: payload.dryRun === true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No fue posible compartir la matrícula.",
      },
      { status: 500 },
    );
  }
}
