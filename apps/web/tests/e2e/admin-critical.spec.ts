import { expect, test, type Page } from "@playwright/test";

import { loginAdmin, requireAdminCredentials } from "./helpers";

async function expectOrderedSidebar(page: Page) {
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText(/^Ajustes Generales$/)).toBeVisible();
  await expect(sidebar.getByText(/^UNIDEP$/)).toBeVisible();
  await expect(sidebar.getByText(/^Administrador$/)).toBeVisible();

  const navText = (await sidebar.locator("nav").innerText()).replace(/\s+/g, " ");
  expect(navText.indexOf("Ajustes Generales")).toBeGreaterThanOrEqual(0);
  expect(navText.indexOf("UNIDEP")).toBeGreaterThan(navText.indexOf("Ajustes Generales"));
  expect(navText.indexOf("Administrador")).toBeGreaterThan(navText.indexOf("UNIDEP"));

  const linkTexts = await sidebar.locator("nav a").allInnerTexts();
  const trimmedTexts = linkTexts.map((text) => text.trim());
  const findIndex = (label: string) => trimmedTexts.indexOf(label);
  const orderedUnidepLabels = [
    "Reporte Operativo",
    "Costos Académicos",
    "Directorio",
    "Programas académicos",
    "Plantel (Dirección)",
  ];
  const orderedAdminLabels = [
    "Comunicados",
    "Usuarios",
    "Organizaciones",
    "Templates WhatsApp",
    "CTA's",
    "Auditoría",
  ];

  for (const orderedLabels of [orderedUnidepLabels, orderedAdminLabels]) {
    for (let index = 0; index < orderedLabels.length - 1; index += 1) {
      const currentIndex = findIndex(orderedLabels[index]);
      const nextIndex = findIndex(orderedLabels[index + 1]);
      if (currentIndex !== -1 && nextIndex !== -1) {
        expect(currentIndex).toBeLessThan(nextIndex);
      }
    }
  }

  const reportIndex = findIndex("Reporte Operativo");
  const adminSectionIndex = navText.indexOf("Administrador");
  if (reportIndex !== -1 && adminSectionIndex !== -1) {
    const reportTextIndex = navText.indexOf("Reporte Operativo");
    expect(reportTextIndex).toBeLessThan(adminSectionIndex);
  }
}

test("admin critical routes stay protected", async ({ page }) => {
  await page.goto("/admin/invitations");
  await expect(page).toHaveURL(/\/admin\/auth/);

  await page.goto("/admin/prices");
  await expect(page).toHaveURL(/\/admin\/auth/);

  await page.goto("/admin\/unidep\/programs".replace(/\\/g, ""));
  await expect(page).toHaveURL(/\/admin\/auth/);
});

test("admin invitations expose the real operational state without broken UI (requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireAdminCredentials();
  await loginAdmin(page, email, password);

  await page.goto("/admin/invitations");
  await expect(page.getByRole("heading", { name: /Invitaciones/i })).toBeVisible();
  await expectOrderedSidebar(page);

  const smtpBlockedBanner = page.getByText(/Envío por correo no disponible|SMTP no configurado/i);
  const emailInvite = `qa-email-${Date.now()}@example.com`;
  const linkInvite = `qa-link-${Date.now()}@example.com`;

  if (!(await smtpBlockedBanner.isVisible().catch(() => false))) {
    await expect(page.getByLabel(/Enviar por correo/i)).toBeEnabled();
    await page.getByLabel(/Enviar por correo/i).check();
    await page.getByRole("textbox", { name: /^Correo$/i }).fill(emailInvite);
    await page.getByRole("combobox", { name: /^Rol$/i }).selectOption("USER");
    await page.getByRole("button", { name: /Enviar invitación/i }).click();

    await expect(
      page.getByText(/Invitación enviada|Invitación creada/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin\/invitations/);
    await expect(page.getByRole("heading", { name: /Invitaciones/i })).toBeVisible();

    await page.getByRole("textbox", { name: /Buscar correo/i }).fill(emailInvite);
    const emailRow = page.locator("tbody tr", { hasText: emailInvite }).first();
    await expect(emailRow).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await emailRow.getByRole("button", { name: /Eliminar/i }).click();
    await expect(page.getByText(/Invitación eliminada/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("tbody tr", { hasText: emailInvite })).toHaveCount(0);
  } else {
    await expect(smtpBlockedBanner).toBeVisible();
    await expect(page.getByLabel(/Enviar por correo/i)).toBeDisabled();
  }

  await page.getByLabel(/Generar enlace directo/i).check();
  await page.getByRole("textbox", { name: /^Correo$/i }).fill(linkInvite);
  await page.getByRole("combobox", { name: /^Rol$/i }).selectOption("USER");
  await page.getByRole("button", { name: /Generar enlace/i }).click();

  await expect(page.getByText(/Enlace generado/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Enlace de invitación/i)).toBeVisible();
  await expect(page.getByText(new RegExp(linkInvite, "i"))).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/invitations/);
  await expect(page.getByRole("heading", { name: /Invitaciones/i })).toBeVisible();

  await page.getByRole("textbox", { name: /Buscar correo/i }).fill(linkInvite);
  const row = page.locator("tbody tr", { hasText: linkInvite }).first();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /Reenviar/i }).click();
  await expect(
    page.getByText(/Invitación reenviada|Invitación regenerada/i),
  ).toBeVisible({ timeout: 30_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: /Cancelar/i }).click();
  await expect(page.getByText(/Invitación cancelada/i)).toBeVisible({ timeout: 30_000 });

  const updatedRow = page.locator("tbody tr", { hasText: linkInvite }).first();
  await expect(updatedRow).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await updatedRow.getByRole("button", { name: /Eliminar/i }).click();
  await expect(page.getByText(/Invitación eliminada/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("tbody tr", { hasText: linkInvite })).toHaveCount(0);
});

test("admin pricing, benefits and PDF catalog pages render key controls (requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)", async ({
  page,
}) => {
  const { email, password } = requireAdminCredentials();
  await loginAdmin(page, email, password);

  await page.goto("/admin/benefits");
  await expect(page.getByRole("heading", { name: /Beneficios adicionales/i })).toBeVisible();
  await page.getByRole("button", { name: /^Nuevo$/i }).click();
  await expect(page.getByRole("dialog", { name: /Beneficio adicional/i })).toBeVisible();
  await page.getByRole("button", { name: /Cerrar/i }).click();

  await page.goto("/admin/prices");
  await expect(page.getByRole("heading", { name: /Precios base y ajustes/i })).toBeVisible();
  const editButton = page.getByRole("button", { name: /^Editar$/i }).first();
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(page.getByText(/Nuevo monto \(MXN\)/i)).toBeVisible();
  await page.getByRole("button", { name: /Cerrar/i }).click();

  await page.goto("/admin/unidep/programs");
  await expect(page.getByRole("heading", { name: /Programas UNIDEP/i })).toBeVisible();
  await expect(page.getByText(/Catálogo de PDFs y metadata/i)).toBeVisible();
  await expect(page.getByText("Plan PDF", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Brochure PDF", { exact: true }).first()).toBeVisible();
});

