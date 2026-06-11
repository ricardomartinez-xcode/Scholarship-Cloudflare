import { describe, expect, it } from "vitest";

import {
  buildMatriculaContactAuditRow,
  buildMatriculaContactRow,
  findMatriculaContactRowIndex,
  MATRICULA_CONTACT_AUDIT_HEADERS,
} from "@/lib/matricula-contact-sheets";

describe("matricula contact sheets", () => {
  it("matches existing contact rows by matricula, name, email, or phone", () => {
    const values = [
      ["contact_key", "nombre", "telefono_normalizado", "telefono_original", "correo", "expediente"],
      ["old-1", "Ana Perez", "6621112233", "662 111 2233", "ana@correo.com", "A123"],
      ["old-2", "Luis Torres", "6649998888", "664 999 8888", "luis@correo.com", "B456"],
    ];

    expect(
      findMatriculaContactRowIndex(values, {
        matricula: "A123",
        fullName: "Otro Nombre",
        email: "otro@correo.com",
        phone: "0000000000",
      }),
    ).toEqual({ rowIndex: 2, matchedBy: "matricula" });

    expect(
      findMatriculaContactRowIndex(values, {
        matricula: "Z999",
        fullName: "luis   torres",
        email: "otro@correo.com",
        phone: "0000000000",
      }),
    ).toEqual({ rowIndex: 3, matchedBy: "fullName" });

    expect(
      findMatriculaContactRowIndex(values, {
        matricula: "Z999",
        fullName: "Sin Nombre",
        email: "ANA@CORREO.COM",
        phone: "0000000000",
      }),
    ).toEqual({ rowIndex: 2, matchedBy: "email" });

    expect(
      findMatriculaContactRowIndex(values, {
        matricula: "Z999",
        fullName: "Sin Nombre",
        email: "nuevo@correo.com",
        phone: "(664) 999-8888",
      }),
    ).toEqual({ rowIndex: 3, matchedBy: "phone" });
  });

  it("builds contact and audit rows with enrollment data", () => {
    const contact = {
      matricula: "A123",
      fullName: "Ana Perez",
      email: "ana@correo.com",
      phone: "(662) 111-2233",
      campus: "Hermosillo",
      region: "Noroeste",
      modality: "Presencial",
      program: "Licenciatura",
      module: "M1",
      cycle: "C1",
      enrollmentType: "nuevo_ingreso",
      scholarshipPercent: 35,
      submittedAt: "2026-06-11T15:00:00.000Z",
    };

    expect(buildMatriculaContactRow(contact)).toEqual([
      "6621112233",
      "Ana Perez",
      "6621112233",
      "(662) 111-2233",
      "ana@correo.com",
      "A123",
      "",
      "Licenciatura",
      "Hermosillo",
      "Inscrito",
      "",
      "",
      "INSCRITO",
      0,
      "Matricula ReCalc",
      "matricula=A123; region=Noroeste; modalidad=Presencial; modulo=M1; ciclo=C1; tipo_ingreso=nuevo_ingreso; beca=35%",
    ]);

    expect(buildMatriculaContactAuditRow("created", contact)).toEqual([
      "created",
      "2026-06-11T15:00:00.000Z",
      "A123",
      "A123",
      "Ana Perez",
      "ana@correo.com",
      "(662) 111-2233",
      "Hermosillo",
      "Noroeste",
      "Presencial",
      "Licenciatura",
      "M1",
      "C1",
      "nuevo_ingreso",
      35,
      "Matricula ReCalc",
    ]);
    expect(MATRICULA_CONTACT_AUDIT_HEADERS).toContain("accion");
  });
});
