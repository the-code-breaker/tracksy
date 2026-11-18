import { test, expect } from "@playwright/test";
test("renders setup, authentication and validation without bypassing auth", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/welcome-${test.info().project.name}.png`,
    fullPage: true,
  });
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create an account" })
    .click();
  await expect(
    page.getByText("Create your account", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(
    page.getByText("Reset your password", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/auth-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("supports a dark theme without horizontal page overflow", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(size.width).toBeLessThanOrEqual(size.viewport);
  await page.screenshot({
    path: `test-results/dark-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("protects group routes without a session", async ({ page }) => {
  await page.goto("/group/00000000-0000-4000-8000-000000000001");
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Everyone’s balance", { exact: true }),
  ).not.toBeVisible();
});

test("can change theme and reveal a password without losing input", async ({
  page,
}) => {
  await page.goto("/");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("Temporary-test-password-123!");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveJSProperty("type", "text");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toBeVisible();
  await expect(password).toHaveValue("Temporary-test-password-123!");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.width).toBeLessThanOrEqual(size.viewport);
});

test("checks the email before sending password recovery", async ({ page }) => {
  let recoveryCalls = 0;
  await page.route("**/auth/v1/recover**", async (route) => {
    recoveryCalls++;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email address", { exact: true }).fill("invalid-email");
  test.skip(
    await page.getByRole("button", { name: "Send reset email" }).isDisabled(),
    "Password recovery submission needs backend configuration.",
  );
  await page.getByRole("button", { name: "Send reset email" }).click();
  await expect(
    page.getByText("Enter a valid email address to receive a reset link."),
  ).toBeVisible();
  expect(recoveryCalls).toBe(0);
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
});
