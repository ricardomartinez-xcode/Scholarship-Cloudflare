import { describe, expect, it } from "vitest";

import {
  PriceImportProjectionError,
  projectEffectivePriceOverrides,
  type PriceImportCoverageRow,
} from "../price-import-coverage-projection";

const published = {
  id: "published-general",
  scope: "base_price",
  targetKeys: {
    nivel_key: "licenciatura",
    modalidad_key: "presencial",
    plan: "9",
  },
  newPrice: 3000,
  isActive: true,
  notes: null,
  updatedBy: null,
};

const live = {
  id: "live-specific",
  scope: "base_price",
  targetKeys: {
    nivel_key: "licenciatura",
    modalidad_key: "presencial",
    plan: "9",
    plantel: "HERMOSILLO",
  },
  newPrice: 3500,
  isActive: true,
  notes: null,
  updatedBy: "admin@example.com",
};

function importRow(
  values: Partial<PriceImportCoverageRow> = {},
): PriceImportCoverageRow {
  return {
    rowNumber: 2,
    action: "create",
    existingId: null,
    scope: "base_price",
    targetKeys: {
      nivel_key: "licenciatura",
      modalidad_key: "presencial",
      plan: "9",
      plantel: "HERMOSILLO",
    },
    newPrice: 3900,
    isActive: true,
    notes: "CSV",
    updatedBy: "admin@example.com",
    ...values,
  };
}

describe("price import coverage projection", () => {
  it("replace conserva publicado y sustituye sólo overrides vivos base_price", () => {
    const current = [
      live,
      {
        ...live,
        id: "live-other-scope",
        scope: "subject_price",
      },
    ];

    const effective = projectEffectivePriceOverrides({
      publishedOverrides: [published],
      currentLiveOverrides: current,
      mode: "replace",
      rows: [
        importRow(),
        importRow({
          rowNumber: 3,
          action: "noop",
          existingId: "live-specific",
          newPrice: 3500,
        }),
      ],
    });

    expect(effective.map((override) => override.id)).toEqual([
      "published-general",
      "live-other-scope",
      "imported:2",
      "imported:3",
    ]);
    expect(effective).not.toContainEqual(
      expect.objectContaining({ id: "live-specific" }),
    );
    expect(current[0]).toEqual(live);
  });

  it("update-only proyecta update y conserva noop", () => {
    const effective = projectEffectivePriceOverrides({
      publishedOverrides: [published],
      currentLiveOverrides: [
        live,
        { ...live, id: "live-noop", newPrice: 3600 },
      ],
      mode: "update-only",
      rows: [
        importRow({
          action: "update",
          existingId: "live-specific",
          newPrice: 4100,
        }),
        importRow({
          rowNumber: 3,
          action: "noop",
          existingId: "live-noop",
          newPrice: 3600,
        }),
      ],
    });

    expect(
      effective.find((override) => override.id === "live-specific"),
    ).toMatchObject({ newPrice: 4100 });
    expect(
      effective.find((override) => override.id === "live-noop"),
    ).toMatchObject({ newPrice: 3600 });
  });

  it("elimina de la cobertura un update proyectado como inactivo", () => {
    const effective = projectEffectivePriceOverrides({
      publishedOverrides: [],
      currentLiveOverrides: [live],
      mode: "update-only",
      rows: [
        importRow({
          action: "update",
          existingId: "live-specific",
          isActive: false,
        }),
      ],
    });

    expect(effective).toEqual([]);
  });

  it("rechaza create en update-only", () => {
    expect(() =>
      projectEffectivePriceOverrides({
        publishedOverrides: [published],
        currentLiveOverrides: [live],
        mode: "update-only",
        rows: [importRow()],
      }),
    ).toThrow(PriceImportProjectionError);
  });
});
