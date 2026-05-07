const BENEFIT_DURATION_LABELS: Record<string, string> = {
  primer_cuatrimestre: "Primer cuatrimestre",
  toda_la_carrera: "Toda la carrera",
  pago_inicial: "Pago inicial",
};

const BENEFIT_DURATION_SENTENCES: Record<string, string> = {
  primer_cuatrimestre: "Aplica durante el primer cuatrimestre.",
  toda_la_carrera: "Aplica durante toda la carrera.",
  pago_inicial: "Aplica al pago inicial.",
};

function normalizeDuration(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

export function formatBenefitDurationLabel(value: string | null | undefined) {
  const normalized = normalizeDuration(value);
  if (!normalized) return null;
  return BENEFIT_DURATION_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}

export function formatBenefitDurationSentence(value: string | null | undefined) {
  const normalized = normalizeDuration(value);
  if (!normalized) return null;
  return (
    BENEFIT_DURATION_SENTENCES[normalized] ??
    `Aplica durante ${normalized.replace(/_/g, " ")}.`
  );
}
