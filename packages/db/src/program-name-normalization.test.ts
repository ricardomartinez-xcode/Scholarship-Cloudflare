import { describe, expect, it } from "vitest";

import {
  normalizeAcademicProgramKey,
  normalizeAcademicProgramName,
} from "./program-name-normalization";

describe("academic program name normalization", () => {
  it("deduplicates high-confidence typos and aliases", () => {
    expect(normalizeAcademicProgramName("Licenciatiura en Ingenieria Industrial y de Sistemas")).toMatchObject({
      name: "Ingenieria Industrial y de Sistemas",
      nameNormalized: "ingenieria industrial y de sistemas",
    });

    expect(normalizeAcademicProgramKey("Industrial y Sistemas")).toBe("ingenieria industrial y de sistemas");
    expect(normalizeAcademicProgramKey("Ingeneriia en Sistemas Computacionales")).toBe(
      "ingenieria en sistemas computacionales",
    );
    expect(normalizeAcademicProgramKey("Adm. de Empresas Tur.")).toBe("administracion de empresas turisticas");
  });

  it("keeps unknown program names but still fixes simple spelling mistakes", () => {
    expect(normalizeAcademicProgramName("Administracion de Negocios y Mecadotecnia")).toMatchObject({
      name: "Administracion de Negocios y Mercadotecnia",
      nameNormalized: "administracion de negocios y mercadotecnia",
    });
  });

  it("normalizes licenciatura prefixes received from academic offer sheets", () => {
    expect(normalizeAcademicProgramName("Licenciatura en Psicología")).toMatchObject({
      name: "Licenciatura en Psicología",
      nameNormalized: "licenciatura en psicologia",
    });
    expect(normalizeAcademicProgramName("Lic. en Derecho")).toMatchObject({
      name: "Licenciatura en Derecho",
      nameNormalized: "licenciatura en derecho",
    });
    expect(normalizeAcademicProgramKey("Enfermería")).toBe("licenciatura en enfermeria");
  });
});
