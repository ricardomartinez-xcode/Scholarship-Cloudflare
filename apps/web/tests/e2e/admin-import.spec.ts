import fs from "node:fs/promises";
import path from "node:path";

import { test, expect } from "@playwright/test";

import { loginAdmin, requireAdminCredentials } from "./helpers";

async function findOfertaExcelPath(): Promise<string | null> {
  try {
    const docsDir = path.join(process.cwd(), "docs");
    const entries = await fs.readdir(docsDir);
    const xlsx = entries.filter((n) => n.toLowerCase().endsWith(".xlsx"));
    const preferred = xlsx.find((n) => n.toLowerCase().includes("oferta"));
    return preferred ? path.join(docsDir, preferred) : null;
  } catch {
    return null;
  }
}

test("admin import page is protected", async ({ page }) => {
  await page.goto("/admin/oferta");
  await expect(page).toHaveURL(/\/admin\/auth/);
});

test("admin can import oferta excel (requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireAdminCredentials();

  const excelPath = await findOfertaExcelPath();
  test.skip(!excelPath, "No docs/*.xlsx found (Oferta Academica).");

  await loginAdmin(page, email, password);

  await page.goto("/admin/oferta");
  await expect(page.getByRole("heading", { level: 1, name: /Oferta Acad/i })).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(excelPath!);

  await page.getByRole("button", { name: /Validar archivo/i }).click();
  await expect(page.getByText(/Borrador listo/i)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Campus procesados/i)).toBeVisible();
  await page.getByRole("link", { name: /Revisar y publicar/i }).click();
  await expect(page).toHaveURL(/\/admin\/importaciones\//);
  await expect(page.getByRole("heading", { name: /Borrador listo para revisión/i })).toBeVisible();

  await page.getByRole("checkbox", { name: /Confirmo que revisé el impacto/i }).check();
  await page.getByPlaceholder("PUBLICAR").fill("PUBLICAR");
  await page.getByRole("button", { name: /Reemplazar oferta/i }).click();
  await expect(page.getByRole("heading", { name: /^Publicada$/i })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByRole("button", { name: /Restaurar snapshot anterior/i })).toBeVisible();
});
