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

  it("keeps popovers and dialogs inside the visible viewport", () => {
    const globals = read("apps/web/src/app/globals.css");
    const a11yPass = read("apps/web/src/app/interface-a11y-responsive-pass.css");
    const smartSelect = read("apps/web/src/components/SmartSelect.tsx");
    const smartMultiSelect = read("apps/web/src/components/SmartMultiSelect.tsx");
    const adminDialog = read("apps/web/src/components/admin/AdminDialogShell.tsx");

    expect(globals).toContain("--radix-popover-content-available-height");
    expect(globals).toContain("calc(100dvh - 24px)");
    expect(a11yPass).toContain("[data-radix-popper-content-wrapper]");
    expect(smartSelect).toContain('sticky="always"');
    expect(smartSelect).toContain("avoidCollisions");
    expect(smartSelect).toContain("function handleTriggerKeyDown");
    expect(smartSelect).toContain('event.key === "ArrowDown"');
    expect(smartSelect).toContain('event.key === "Enter"');
    expect(smartMultiSelect).toContain('sticky="always"');
    expect(smartMultiSelect).toContain("avoidCollisions");
    expect(smartMultiSelect).toContain("function handleTriggerKeyDown");
    expect(adminDialog).toContain("max-h-[calc(100dvh-1rem)]");
  });

  it("keeps admin navigation ordered by daily workflow", () => {
    const source = read("apps/web/src/config/dashboard-navigation.ts");
    const order = [
      'key: "admin-summary"',
      'key: "admin-access"',
      'key: "admin-academics"',
      'key: "admin-unidep-catalogs"',
      'key: "admin-communication"',
      'key: "admin-system"',
    ];

    let previous = -1;
    for (const marker of order) {
      const index = source.indexOf(marker);
      expect(index, marker).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it("keeps autopilot and bot configuration visible in admin navigation", () => {
    const source = read("apps/web/src/config/dashboard-navigation.ts");
    const autopilotPagePath =
      "apps/web/src/app/(admin)/admin/(protected)/autopilot/page.tsx";
    const botsPagePath =
      "apps/web/src/app/(admin)/admin/(protected)/capacitacion/bots/page.tsx";

    expect(source).toContain('key: "autopilot"');
    expect(source).toContain('label: "Autopilot"');
    expect(source).toContain('href: "/admin/autopilot"');
    expect(source).toContain('"/admin/autopilot": "Autopilot"');
    expect(source).toContain('key: "training-bots"');
    expect(source).toContain('label: "Configuración de bots"');
    expect(source).toContain('href: "/admin/capacitacion/bots"');
    expect(source).toContain('"/admin/capacitacion/bots": "Configuración de bots"');
    expect(fs.existsSync(path.join(rootDir, autopilotPagePath))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, botsPagePath))).toBe(true);
    expect(read(botsPagePath)).toContain('listRoleplayBots');
    expect(read(botsPagePath)).toContain('PRELOADED_ROLEPLAY_KNOWLEDGE');
  });

  it("keeps autopilot date rendering stable across server and browser runtimes", () => {
    const source = read(
      "apps/web/src/app/(admin)/admin/(protected)/autopilot/AutopilotClient.tsx",
    );

    expect(source).toContain('const ADMIN_DISPLAY_TIME_ZONE = "America/Mexico_City"');
    expect(source).toContain("formatToParts(new Date(value))");
    expect(source).toContain("`${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`");
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
