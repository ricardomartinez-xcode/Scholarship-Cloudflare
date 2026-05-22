import { expect, test } from "@playwright/test";

import { loginAdmin, loginUser, requireAdminCredentials } from "./helpers";

test("auth welcome announcements configured in admin are visible in /unidep", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { email, password } = requireAdminCredentials();

  await loginAdmin(page, email, password);
  await page.goto("/admin/comunicados");

  const welcomeLocation = page.getByText(
    /App UNIDEP — (dentro del panel de bienvenida|bienvenida post-login)/i,
  ).first();

  test.skip(
    (await welcomeLocation.count()) === 0,
    "No auth welcome announcements are configured in this environment.",
  );

  const announcementCard = welcomeLocation.locator(
    "xpath=ancestor::div[contains(@class,'rounded-2xl')][1]",
  );
  await expect(announcementCard).toBeVisible();

  const title = (await announcementCard
    .locator("div.text-sm.font-semibold.text-slate-100")
    .first()
    .innerText()).trim();

  test.skip(!title, "Configured auth welcome announcement has no visible title.");

  await loginUser(page, email, password);
  await expect(page.getByText(title, { exact: false })).toBeVisible();
});

test("unidep primary announcements configured in admin are visible in /unidep", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { email, password } = requireAdminCredentials();

  await loginAdmin(page, email, password);
  await page.goto("/admin/comunicados");

  const primaryLocation = page.getByText(
    /App UNIDEP — banner de acciones \(pantalla principal\)/i,
  ).first();

  test.skip(
    (await primaryLocation.count()) === 0,
    "No UNIDEP primary announcements are configured in this environment.",
  );

  const announcementCard = primaryLocation.locator(
    "xpath=ancestor::div[contains(@class,'rounded-2xl')][1]",
  );
  await expect(announcementCard).toBeVisible();

  const title = (await announcementCard
    .locator("div.text-sm.font-semibold.text-slate-100")
    .first()
    .innerText()).trim();

  test.skip(!title, "Configured UNIDEP primary announcement has no visible title.");

  await loginUser(page, email, password);
  await expect(page.getByText(title, { exact: false })).toBeVisible();
});
