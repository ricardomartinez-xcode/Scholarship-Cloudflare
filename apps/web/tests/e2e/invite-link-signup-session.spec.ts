import { expect, test } from "@playwright/test";

import { loginAdmin, requireAdminCredentials } from "./helpers";

test.setTimeout(120_000);

test("invite link signup path keeps the admin session intact", async ({
  browser,
  page: adminPage,
}) => {
  const admin = requireAdminCredentials();
  const recipientEmail = `qa-invite-${Date.now()}@example.com`;
  const recipientPassword = `Invite-${Date.now()}-Qa1!`;

  await loginAdmin(adminPage, admin.email, admin.password);
  await adminPage.goto("/admin/invitations");
  await expect(
    adminPage.getByRole("heading", { name: /Invitaciones/i }),
  ).toBeVisible();

  await adminPage.getByLabel(/Generar enlace directo/i).check();
  await adminPage.getByRole("textbox", { name: /^Correo$/i }).fill(recipientEmail);
  await adminPage.getByRole("combobox", { name: /^Rol$/i }).selectOption("USER");
  await adminPage.getByRole("button", { name: /Generar enlace/i }).click();

  await expect(adminPage.getByText(/Enlace generado/i)).toBeVisible({ timeout: 30_000 });
  const inviteUrlInput = adminPage.getByRole("textbox", {
    name: /Enlace de invitación/i,
  });
  const inviteUrl = await inviteUrlInput.inputValue();

  await adminPage.reload();
  await expect(adminPage).toHaveURL(/\/admin\/invitations/);
  await expect(
    adminPage.getByRole("heading", { name: /Invitaciones/i }),
  ).toBeVisible();

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  let autoAccepted = false;

  try {
    await recipientPage.goto(inviteUrl);
    await expect(recipientPage).toHaveURL(/\/auth\/sign-in/);

    const signInEmailField = recipientPage.getByLabel(/Correo/i);
    await expect(signInEmailField).toHaveValue(recipientEmail);
    await expect(signInEmailField).toHaveJSProperty("readOnly", true);
    await expect(recipientPage.getByRole("link", { name: /Crear cuenta/i })).toBeVisible();

    await recipientPage.getByRole("link", { name: /Crear cuenta/i }).click();
    await expect(recipientPage).toHaveURL(/\/auth\/sign-up\?token=/);

    const signUpEmailField = recipientPage.getByLabel(/Correo/i);
    await expect(signUpEmailField).toHaveValue(recipientEmail);
    await expect(signUpEmailField).toHaveJSProperty("readOnly", true);
    await recipientPage.locator('input[name="password"]').fill(recipientPassword);
    await recipientPage.getByRole("button", { name: /Crear cuenta/i }).click();

    autoAccepted = await recipientPage
      .waitForURL(/\/unidep\?welcome=1(&newUser=1)?/, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!autoAccepted) {
      await expect(recipientPage).toHaveURL(/\/auth\/sign-in\?/);
      await expect(
        recipientPage.getByText(/Cuenta creada\. Revisa tu correo para verificar/i),
      ).toBeVisible({ timeout: 30_000 });
    }
  } finally {
    await recipientContext.close();
  }

  await adminPage.reload();
  await expect(adminPage).toHaveURL(/\/admin\/invitations/);
  await expect(
    adminPage.getByRole("heading", { name: /Invitaciones/i }),
  ).toBeVisible();
  await adminPage.getByRole("textbox", { name: /Buscar correo/i }).fill(recipientEmail);
  const inviteRow = adminPage.locator("tbody tr", { hasText: recipientEmail }).first();
  await expect(inviteRow).toBeVisible();
  await expect(inviteRow.getByText(autoAccepted ? /Usada/i : /Pendiente/i)).toBeVisible();
});
