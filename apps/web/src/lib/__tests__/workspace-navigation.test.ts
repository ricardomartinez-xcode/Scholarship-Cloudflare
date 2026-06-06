import { describe, expect, it } from "vitest";

import {
  flattenDashboardNavItems,
  workspaceFooterNavItems,
  workspaceNavGroups,
} from "../../config/dashboard-navigation";

function childKeys(parentKey: string) {
  const parent = flattenDashboardNavItems(workspaceNavGroups).find(
    (item) => item.key === parentKey,
  );
  return parent?.children?.map((child) => child.key) ?? [];
}

describe("workspace navigation", () => {
  it("organizes authenticated app sections by daily workflow", () => {
    expect(workspaceNavGroups.map((group) => group.key)).toEqual([
      "workspace-daily-operations",
      "workspace-communication",
      "workspace-academic-offer",
      "workspace-unidep-catalogs",
      "workspace-training",
    ]);

    expect(workspaceNavGroups.map((group) => group.label)).toEqual([
      "Operación diaria",
      "Comunicación",
      "Oferta académica",
      "Catálogos UNIDEP",
      "Capacitación",
    ]);

    expect(workspaceNavGroups[0]?.items.map((item) => item.key)).toEqual([
      "becas",
      "contactos",
      "inbox",
      "historial",
    ]);
    expect(childKeys("comunicacion")).toEqual(["web", "waba"]);
    expect(childKeys("oferta")).toEqual(["oferta-academica", "planes"]);
    expect(childKeys("catalogos")).toEqual([
      "formatos",
      "costos",
      "planteles",
      "directorio",
    ]);
    expect(childKeys("capacitacion")).toEqual([
      "rolplay",
      "materiales",
      "evaluaciones",
    ]);
    expect(workspaceFooterNavItems).toEqual([]);
  });
});
