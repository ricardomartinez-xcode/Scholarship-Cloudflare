import {
  normalizeBusinessLine,
  normalizeCanonicalModality,
} from "@/lib/pricing-normalize";

type StaticPriceTable = Record<number, number>;

const STATIC_BASE_PRICE_TABLE: Record<string, Record<string, StaticPriceTable>> = {
  salud: {
    presencial: { 9: 6400, 11: 6900 },
    mixta: { 9: 6200, 11: 6700 },
    online: { 9: 5900, 11: 6400 },
  },
  licenciatura: {
    presencial: { 9: 5600, 11: 6100 },
    mixta: { 9: 5400, 11: 5900 },
    online: { 9: 5200, 11: 5700 },
  },
  prepa: {
    presencial: { 6: 3200, 9: 3600 },
    mixta: { 6: 3100, 9: 3500 },
    online: { 6: 2950, 9: 3350 },
  },
  posgrado: {
    presencial: { 9: 7600, 11: 8200 },
    mixta: { 9: 7300, 11: 7900 },
    online: { 9: 7100, 11: 7700 },
  },
};

function normalizePlan(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.round(parsed);
  return normalized > 0 ? normalized : null;
}

export function findStaticBasePrice(input: {
  businessLine: string | null | undefined;
  modality: string | null | undefined;
  plan: number | string | null | undefined;
}) {
  const businessLine = normalizeBusinessLine(input.businessLine);
  const modality = normalizeCanonicalModality(input.modality);
  const plan = normalizePlan(input.plan);

  if (!businessLine || !modality || plan === null) return null;

  const byModality = STATIC_BASE_PRICE_TABLE[businessLine]?.[modality];
  if (!byModality) return null;

  if (typeof byModality[plan] === "number") return byModality[plan];

  const sortedPlans = Object.keys(byModality)
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!sortedPlans.length) return null;

  const nearest =
    sortedPlans.find((candidate) => plan <= candidate) ??
    sortedPlans[sortedPlans.length - 1];
  return byModality[nearest] ?? null;
}
