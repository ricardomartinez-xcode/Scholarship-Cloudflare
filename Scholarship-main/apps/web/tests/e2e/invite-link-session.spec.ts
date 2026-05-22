import { expect, test } from "@playwright/test";

import {
  loginAdmin,
  requireAdminCredentials,
  requireUserCredentials,
} from "./helpers";

test.setTimeout(120_000);

test("invite link acceptance keeps the admin session intact", async ({
  browser,
  page: adminPage,
}) => {
  const admin = requireAdminCredentials();
  const recipient = requireUserCredentials();

  test.skip(
    admin.email.toLowerCase() === recipient.email.toLowerCase(),
    "Usa un correo invitado distinto al del admin.",
  );

  await loginAdmin(adminPage, admin.email, admin.password);
  await adminPage.goto("/admin/invitations");
  await expect(
    adminPage.getByRole("heading", { name: /Invitaciones/i }),
  ).toBeVisible();

  await adminPage.getByLabel(/Generar enlace directo/i).check();
  await adminPage.getByRole("textbox", { name: /^Correo$/i }).fill(recipient.email);
  await adminPage.getByRole("combobox", { name: /^Rol$/i }).selectOption("USER");
  await adminPage.getByRole("button", { name: /Generar enlace/i }).click();

  await expect(adminPage.getByText(/Enlace generado/i)).toBeVisible({ timeout: 30_000 });
  const inviteUrlInput = adminPage.getByRole("textbox", {
    name: /Enlace de invitación/i,
  });
  await expect(inviteUrlInput).toHaveValue(/\/invite\/accept\?token=/);
  const inviteUrl = await inviteUrlInput.inputValue();

  await adminPage.reload();
  await expect(adminPage).toHaveURL(/\/admin\/invitations/);
  await expect(
    adminPage.getByRole("heading", { name: /Invitaciones/i }),
  ).toBeVisible();
  await adminPage.getByRole("textbox", { name: /Buscar correo/i }).fill(recipient.email);
  const pendingRow = adminPage.locator("tbody tr", { hasText: recipient.email }).first();
  await expect(pendingRow).toBeVisible();
  await expect(pendingRow.getByText(/Pendiente/i)).toBeVisible();

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();

  try {
    await recipientPage.goto(inviteUrl);
    await expect(recipientPage).toHaveURL(/\/auth\/sign-in/);

    const emailField = recipientPage.getByLabel(/Correo/i);
    await expect(emailField).toHaveValue(recipient.email);
    await expect(emailField).toHaveJSProperty("readOnly", true);

    await recipientPage.locator('input[name="password"]').fill(recipient.password);
    await recipientPage.getByRole("button", { name: /Iniciar sesi/i }).click();

    await expect(recipientPage).toHaveURL(/\/unidep\?welcome=1(&newUser=1)?/, {
      timeout: 30_000,
    });
  } finally {
    await recipientContext.close();
  }

  await adminPage.reload();
  await expect(adminPage).toHaveURL(/\/admin\/invitations/);
  await expect(
    adminPage.getByRole("heading", { name: /Invitaciones/i }),
  ).toBeVisible();
  await adminPage.getByRole("textbox", { name: /Buscar correo/i }).fill(recipient.email);
  const usedRow = adminPage.locator("tbody tr", { hasText: recipient.email }).first();
  await expect(usedRow).toBeVisible();
  await expect(usedRow.getByText(/Usada/i)).toBeVisible();
});
