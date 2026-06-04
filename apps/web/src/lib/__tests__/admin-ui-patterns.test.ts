import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("admin UI patterns", () => {
  it("uses the shared admin segmented tabs component in dense admin modules", () => {
    const componentPath = "apps/web/src/components/admin/AdminSegmentedTabs.tsx";
    expect(fs.existsSync(path.join(rootDir, componentPath))).toBe(true);

    for (const relativePath of [
      "apps/web/src/components/admin/PricesClient.tsx",
      "apps/web/src/components/admin/BenefitsClient.tsx",
      "apps/web/src/app/(admin)/admin/(protected)/unidep/fees/FeesClient.tsx",
    ]) {
      expect(read(relativePath)).toContain(
        'import AdminSegmentedTabs from "@/components/admin/AdminSegmentedTabs"',
      );
    }
  });

  it("keeps shared admin tabs keyboard navigable", () => {
    const source = read("apps/web/src/components/admin/AdminSegmentedTabs.tsx");

    expect(source).toContain("role=\"tablist\"");
    expect(source).toContain("role=\"tab\"");
    expect(source).toContain("tabIndex={selected ? 0 : -1}");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("Home");
    expect(source).toContain("End");
  });

  it("mounts the shared Excel-style table enhancer in protected admin pages", () => {
    const layout = read("apps/web/src/app/(admin)/admin/(protected)/layout.tsx");
    const enhancer = read("apps/web/src/components/admin/AdminTableExcelEnhancer.tsx");

    expect(layout).toContain("AdminTableExcelEnhancer");
    expect(enhancer).toContain('[aria-label="Contenido admin"] table');
    expect(enhancer).toContain(".ui-table-wrap table");
    expect(enhancer).toContain("Buscar en tabla");
    expect(enhancer).toContain("Filtrar columna");
    expect(enhancer).toContain("Columnas");
    expect(enhancer).toContain("CSV");
  });

  it("exposes academic offer module subjects as their own table column", () => {
    const source = read("apps/web/src/components/admin/OfferImportClient.tsx");

    expect(source).toContain("ACADEMIC_MODULES.map");
    expect(source).toContain('<th className="ui-cell-nowrap text-left">Materias por módulo</th>');
    expect(source).toContain("<td className=\"text-xs text-slate-300\">{row.subjectsByModule ?? \"—\"}</td>");
  });
});
