import { test, expect } from "@playwright/test";

import {
  chooseOptionByIndex,
  chooseOptionByName,
  loginUser,
  requireUserCredentials,
  waitForCalculatorReady,
} from "./helpers";

async function fillValidQuote(page: import("@playwright/test").Page) {
  const tipo = page.getByRole("combobox", { name: /Tipo de inscripción/i });
  const nivel = page.getByRole("combobox", { name: /Línea de negocio/i });
  const modalidad = page.getByRole("combobox", { name: /Modalidad/i });
  const plan = page.getByRole("combobox", { name: /Plan de estudios/i });
  const plantel = page.getByRole("combobox", { name: /Plantel/i });
  const promedio = page.getByRole("textbox", { name: /Promedio/i });

  await chooseOptionByName(page, tipo, /Nuevo ingreso/i);
  await chooseOptionByIndex(page, nivel, 0);
  await chooseOptionByIndex(page, modalidad, 0);
  await chooseOptionByIndex(page, plan, 0);

  if (await plantel.isEnabled().catch(() => false)) {
    await chooseOptionByIndex(page, plantel, 0);
  }

  await promedio.fill("8.56");
}

test("cost flow works for several valid combinations (no false 'no cost' error)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { email, password } = requireUserCredentials();
  await loginUser(page, email, password);
  await expect(
    page.getByRole("heading", { name: /Cotizador|Calculadora/i }),
  ).toBeVisible();

  // No native selects are allowed in /unidep.
  await expect(page.locator("select")).toHaveCount(0);

  // Wait for data to be loaded so selects become enabled.
  await waitForCalculatorReady(page);

  const tipo = page.getByRole("combobox", { name: /Tipo de inscripción/i });
  const nivel = page.getByRole("combobox", { name: /Línea de negocio/i });
  const modalidad = page.getByRole("combobox", { name: /Modalidad/i });
  const plan = page.getByRole("combobox", { name: /Plan de estudios/i });
  const plantel = page.getByRole("combobox", { name: /Plantel/i });
  const promedio = page.getByRole("textbox", { name: /Promedio/i });

  await expect(nivel).toBeEnabled({ timeout: 90_000 });

  for (let i = 0; i < 3; i++) {
    await chooseOptionByName(page, tipo, /Nuevo ingreso/i);

    // Choose different niveles to increase chances of catching mapping issues.
    await chooseOptionByIndex(page, nivel, i);

    await chooseOptionByIndex(page, modalidad, 0);
    await chooseOptionByIndex(page, plan, 0);

    if (await plantel.isEnabled().catch(() => false)) {
      await chooseOptionByIndex(page, plantel, 0);
    }

    await promedio.fill("8.56");

    await expect(page.getByText(/No se encontró costo/i)).toHaveCount(0);
    await expect(page.getByText("Resultado", { exact: true })).toBeVisible();
    await expect(page.getByText("Precio lista", { exact: true })).toBeVisible();
    await expect(page.getByText("TOTAL", { exact: true })).toBeVisible();

    const programaOferta = page.getByRole("combobox", { name: /^Programa$/i });
    if (await programaOferta.isEnabled().catch(() => false)) {
      await chooseOptionByIndex(page, programaOferta, 0);
      await expect(
        page.getByRole("link", { name: /Descargar plan de estudios/i })
          .or(page.getByRole("button", { name: /Plan no disponible/i })),
      ).toBeVisible();
    }
  }
});

test("results panel surfaces commercial summary and whatsapp copy", async ({ page }) => {
  test.setTimeout(120_000);
  const { email, password } = requireUserCredentials();
  await loginUser(page, email, password);
  await waitForCalculatorReady(page);

  await fillValidQuote(page);

  await expect(page.getByTestId("results-panel")).toBeVisible();
  await expect(page.getByTestId("results-total-amount")).toBeVisible();

  const preview = page.getByTestId("whatsapp-preview");
  await expect(preview).toHaveValue(/Precio lista:/i);
  await expect(preview).toHaveValue(/Total(?::| a pagar:)/i);
  await expect(
    preview,
  ).toHaveValue(/revisemos juntos los pasos para continuar|explico cómo seguir/i);

  await page.getByTestId("copy-whatsapp-button").click();
  await expect(page.getByTestId("whatsapp-copy-feedback")).toContainText(
    /Texto copiado|No se pudo copiar autom[aá]ticamente/i,
  );
});
