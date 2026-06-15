import type { AcademicOfferCycle } from "@/config/academicOffer";

export const ACADEMIC_OFFER_SCHEDULE_FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "escolarizado", label: "Escolarizado" },
  { value: "ejecutivo", label: "Ejecutivo" },
  { value: "online", label: "Online" },
] as const;

export type AcademicOfferScheduleFilter =
  (typeof ACADEMIC_OFFER_SCHEDULE_FILTER_OPTIONS)[number]["value"];

export function buildOfertaAcademicaQuery({
  campus,
  line,
  cycle,
  schedule,
}: {
  campus: string;
  line: string;
  cycle: AcademicOfferCycle | "";
  schedule: AcademicOfferScheduleFilter;
}) {
  const params = new URLSearchParams();
  if (campus) params.set("campus", campus);
  if (line) params.set("line", line);
  if (cycle) params.set("cycle", cycle);
  if (schedule) params.set("modality", schedule);
  return params;
}
