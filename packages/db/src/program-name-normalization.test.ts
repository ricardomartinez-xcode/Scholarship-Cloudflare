import { describe, expect, it } from "vitest";

import {
  normalizeAcademicProgramKey,
  normalizeAcademicProgramName,
} from "./program-name-normalization";

describe("academic program name normalization", () => {
  it("deduplicates high-confidence typos and aliases", () => {
    expect(normalizeAcademicProgramName("Licenciatiura en Ingenieria Industrial y de Sistemas")).toMatchObject({
      name: "Licenciatura en Ingeniería Industrial y de Sistemas",
      nameNormalized: "licenciatura en ingenieria industrial y de sistemas",
    });

    expect(normalizeAcademicProgramKey("Industrial y Sistemas")).toBe(
      "licenciatura en ingenieria industrial y de sistemas",
    );
    expect(normalizeAcademicProgramKey("Ingeneriia en Sistemas Computacionales")).toBe(
      "licenciatura en ingenieria en sistemas computacionales",
    );
    expect(normalizeAcademicProgramKey("Adm. de Empresas Tur.")).toBe(
      "licenciatura en administracion de empresas turisticas",
    );
  });

  it("keeps unknown program names but still fixes simple spelling mistakes", () => {
    expect(normalizeAcademicProgramName("Administracion de Negocios y Mecadotecnia")).toMatchObject({
      name: "Administracion de Negocios y Mercadotecnia",
      nameNormalized: "administracion de negocios y mercadotecnia",
    });
  });

  it("normalizes licenciatura prefixes received from academic offer sheets", () => {
    expect(normalizeAcademicProgramName("Administracion de Empresas")).toMatchObject({
      name: "Licenciatura en Administración de Empresas",
      nameNormalized: "licenciatura en administracion de empresas",
    });
    expect(normalizeAcademicProgramName("Ingeniería en Logística")).toMatchObject({
      name: "Licenciatura en Ingeniería en Logística",
      nameNormalized: "licenciatura en ingenieria en logistica",
    });
    expect(normalizeAcademicProgramName("Relaciones Internacionales")).toMatchObject({
      name: "Licenciatura en Relaciones Internacionales",
      nameNormalized: "licenciatura en relaciones internacionales",
    });
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

  it("normalizes posgrados to start with Maestría en", () => {
    expect(normalizeAcademicProgramName("Logistica y Cadena de Suministro")).toMatchObject({
      name: "Maestría en Logística y Cadena de Suministro",
      nameNormalized: "maestria en logistica y cadena de suministro",
    });
    expect(normalizeAcademicProgramName("Administracion Financiera", { level: "POSGRADO" })).toMatchObject({
      name: "Maestría en Administración Financiera",
      nameNormalized: "maestria en administracion financiera",
    });
    expect(normalizeAcademicProgramName("Maestria Administracion Financiera")).toMatchObject({
      name: "Maestría en Administración Financiera",
      nameNormalized: "maestria en administracion financiera",
    });
    expect(normalizeAcademicProgramName("Maestría en Administración de Negocios y Mecadotecnia")).toMatchObject({
      name: "Maestría en Administración de Negocios y Mercadotecnia",
      nameNormalized: "maestria en administracion de negocios y mercadotecnia",
    });
  });

  it("normalizes bachillerato variants with explicit duration or online mode", () => {
    expect(normalizeAcademicProgramName("Prepa_2 años.pdf")).toMatchObject({
      name: "Bachillerato General - Formación en Administración (2 años)",
      nameNormalized: "bachillerato general formacion en administracion 2 anos",
    });
    expect(normalizeAcademicProgramName("Bachillerato", { businessLine: "prepa", pricingPlans: [3] })).toMatchObject({
      name: "Bachillerato General - Formación en Administración (3 años)",
      nameNormalized: "bachillerato general formacion en administracion 3 anos",
    });
    expect(normalizeAcademicProgramName("Bachillerato General - Formacion en Administracion (2 y 3 Años)")).toMatchObject({
      name: "Bachillerato General - Formación en Administración (2 y 3 años)",
      nameNormalized: "bachillerato general formacion en administracion 2 y 3 anos",
    });
    expect(normalizeAcademicProgramName("Bachillerato online")).toMatchObject({
      name: "Bachillerato General - Formación en Administración Online",
      nameNormalized: "bachillerato general formacion en administracion online",
    });
  });
});
