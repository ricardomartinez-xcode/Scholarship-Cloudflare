import { describe, expect, it } from "vitest";

import {
  ACADEMIC_OFFER_SCHEDULE_FILTER_OPTIONS,
  buildOfertaAcademicaQuery,
} from "@/lib/oferta-academica-filters";

describe("buildOfertaAcademicaQuery", () => {
  it("includes the horario filter as the public oferta modality query", () => {
    const query = buildOfertaAcademicaQuery({
      campus: "chihuahua",
      line: "licenciatura",
      cycle: "C1",
      schedule: "ejecutivo",
    });

    expect(query.toString()).toBe(
      "campus=chihuahua&line=licenciatura&cycle=C1&modality=ejecutivo",
    );
  });

  it("omits empty filters", () => {
    const query = buildOfertaAcademicaQuery({
      campus: "",
      line: "",
      cycle: "",
      schedule: "",
    });

    expect(query.toString()).toBe("");
  });
});

describe("ACADEMIC_OFFER_SCHEDULE_FILTER_OPTIONS", () => {
  it("exposes the visible horario choices requested for oferta", () => {
    expect(ACADEMIC_OFFER_SCHEDULE_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      "Todos",
      "Escolarizado",
      "Ejecutivo",
      "Online",
    ]);
  });
});
