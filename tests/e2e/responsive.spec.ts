import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
]) {
  test(`authentication actions fit and remain reachable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const create = page.getByRole("button", {
      name: "Create an account",
      exact: true,
    });
    await expect(create).toBeInViewport();
    await create.click();
    await expect(
      page.getByText("Create your account", { exact: true }),
    ).toBeVisible();
    const submit = page.getByRole("button", {
      name: "Create account",
      exact: true,
    });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    const button = await submit.boundingBox();
    expect(button?.height).toBeGreaterThanOrEqual(48);
    expect(button!.x).toBeGreaterThanOrEqual(0);
    expect(button!.x + button!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page
      .getByRole("button", { name: "Already have an account? Sign in" })
      .click();
    await page.getByRole("button", { name: "Forgot your password?" }).click();
    await expect(
      page.getByRole("button", { name: "Send reset email" }),
    ).toBeVisible();
  });
}

test("forms can scroll to actions when the usable screen height is reduced", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Password", { exact: true })
    .fill("Temporary-test-password-123!");
  await page.setViewportSize({ width: 360, height: 330 });
  const submit = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "Temporary-test-password-123!",
  );
});
