import {
  AdminAdditionalBenefitType,
  BenefitBusinessLine,
  BenefitModality,
  CanonicalModality,
  EnrollmentType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    adminPriceOverride: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    adminAdditionalBenefit: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    adminAdditionalBenefitCampus: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    scholarshipRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    txMock: tx,
    prismaMock: {
      ...tx,
      $transaction: vi.fn(async (callback) => callback(tx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { applyPreparedBaseScholarshipsImport } from "@/lib/importers/base-scholarships-csv";
import { applyPreparedBenefitsImport } from "@/lib/importers/benefits-csv";
import { applyPreparedPricesImport } from "@/lib/importers/prices-csv";

describe("prepared importer apply upserts", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockClear();

    txMock.adminPriceOverride.findMany.mockReset();
    txMock.adminPriceOverride.findUnique.mockReset();
    txMock.adminPriceOverride.update.mockReset();
    txMock.adminPriceOverride.create.mockReset();
    txMock.adminPriceOverride.deleteMany.mockReset();

    txMock.adminAdditionalBenefit.findMany.mockReset();
    txMock.adminAdditionalBenefit.findUnique.mockReset();
    txMock.adminAdditionalBenefit.update.mockReset();
    txMock.adminAdditionalBenefit.create.mockReset();
    txMock.adminAdditionalBenefit.deleteMany.mockReset();
    txMock.adminAdditionalBenefitCampus.deleteMany.mockReset();
    txMock.adminAdditionalBenefitCampus.createMany.mockReset();

    txMock.scholarshipRule.findMany.mockReset();
    txMock.scholarshipRule.findUnique.mockReset();
    txMock.scholarshipRule.update.mockReset();
    txMock.scholarshipRule.create.mockReset();
    txMock.scholarshipRule.deleteMany.mockReset();
  });

  it("updates an existing price override even when the prepared payload was stale create", async () => {
    txMock.adminPriceOverride.findMany.mockResolvedValue([
      {
        id: "price-1",
        targetKeys: {
          nivel_key: "licenciatura",
          modalidad_key: "presencial",
          plan: "9",
          modulo: "Longitudinal",
          tier: "T1",
        },
        newPrice: 5000,
        isActive: true,
        notes: null,
      },
    ]);

    const summary = await applyPreparedPricesImport({
      updatedBy: "admin@test.local",
      payload: {
        rows: [
          {
            rowNumber: 2,
            action: "create",
            key: "||licenciatura|presencial|9|longitudinal|t1",
            existingId: null,
            region: null,
            plantel: null,
            programaKey: null,
            scopePreset: "general",
            scopeLabel: "General",
            nivelKey: "licenciatura",
            modalidadKey: "presencial",
            plan: "9",
            module: "Longitudinal",
            tier: "T1",
            newPrice: 5100,
            subjectPrice: null,
            isActive: true,
            notes: "actualizado",
          },
        ],
      },
    });

    expect(txMock.adminPriceOverride.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "price-1" } }),
    );
    expect(txMock.adminPriceOverride.create).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
  });

  it("updates an existing additional benefit by scope instead of adding another benefit", async () => {
    txMock.adminAdditionalBenefit.findMany.mockResolvedValue([
      {
        id: "benefit-1",
        benefitType: AdminAdditionalBenefitType.percentage,
        enrollmentType: EnrollmentType.nuevo_ingreso,
        businessLine: BenefitBusinessLine.licenciatura,
        modality: BenefitModality.presencial,
        duration: null,
        appliesToAll: false,
        campuses: [{ campusId: "campus-1" }],
        extraPercent: 10,
        firstPaymentAmount: 0,
        isActive: true,
        notes: null,
      },
    ]);

    const summary = await applyPreparedBenefitsImport({
      updatedBy: "admin@test.local",
      payload: {
        rows: [
          {
            rowNumber: 2,
            action: "create",
            key: "percentage|nuevo_ingreso|licenciatura|presencial|__ANY__|campus-1",
            existingId: null,
            region: null,
            tier: null,
            benefitType: AdminAdditionalBenefitType.percentage,
            enrollmentType: EnrollmentType.nuevo_ingreso,
            businessLine: BenefitBusinessLine.licenciatura,
            modality: BenefitModality.presencial,
            duration: null,
            appliesToAll: false,
            campusIds: ["campus-1"],
            campusLabels: ["Chihuahua"],
            extraPercent: 15,
            firstPaymentAmount: 0,
            isActive: true,
            notes: "actualizado",
          },
        ],
      },
    });

    expect(txMock.adminAdditionalBenefit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "benefit-1" } }),
    );
    expect(txMock.adminAdditionalBenefit.create).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
  });

  it("updates an existing base scholarship rule by natural key instead of creating duplicates", async () => {
    txMock.scholarshipRule.findMany.mockResolvedValue([
      {
        id: "rule-1",
        enrollmentType: EnrollmentType.nuevo_ingreso,
        businessLine: BenefitBusinessLine.licenciatura,
        modality: CanonicalModality.presencial,
        plan: 9,
        campusTier: "T1",
        region: "",
        plantel: "",
        programaKey: "",
        minAverage: 8,
        maxAverage: 8.9,
        scholarshipPercent: 20,
      },
    ]);

    const summary = await applyPreparedBaseScholarshipsImport({
      updatedBy: "admin@test.local",
      payload: {
        rows: [
          {
            rowNumber: 2,
            action: "create",
            key: "nuevo_ingreso|licenciatura|presencial|9|T1||||8|8.9",
            existingId: null,
            region: null,
            plantel: null,
            programaKey: null,
            tier: "T1",
            enrollmentType: EnrollmentType.nuevo_ingreso,
            businessLine: BenefitBusinessLine.licenciatura,
            modality: CanonicalModality.presencial,
            plan: 9,
            minAverage: 8,
            maxAverage: 8.9,
            scholarshipPercent: 25,
            notes: null,
          },
        ],
      },
    });

    expect(txMock.scholarshipRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rule-1" } }),
    );
    expect(txMock.scholarshipRule.create).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
  });
});
