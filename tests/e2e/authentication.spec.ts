import { test, expect } from "@playwright/test";

test("signup requires a name and matching passwords before sending a request", async ({page})=>{
 let calls=0;
 await page.route('**/auth/v1/signup**',async route=>{calls++;await route.fulfill({status:500,json:{msg:'Unexpected signup request'}})});
 await page.goto('/');
 await page.getByRole('button',{name:'Create an account',exact:true}).click();
 await page.getByLabel('Email address',{exact:true}).fill('tester@example.com');
 await page.getByLabel('Password',{exact:true}).fill('new-password-123');
 await page.getByLabel('Confirm password',{exact:true}).fill('different-password');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByText('Enter your full name.',{exact:true})).toBeVisible();
 await page.getByLabel('Full name',{exact:true}).fill('Test User');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByText('Your passwords do not match.',{exact:true})).toBeVisible();
 expect(calls).toBe(0);
});

test("Google cancellation returns a readable error and allows returning to sign in",async({page})=>{
 await page.route('**/auth/v1/authorize**',async route=>{
  const u=new URL(route.request().url());
  expect(u.searchParams.get('provider')).toBe('google');
  expect(u.searchParams.get('code_challenge')).toBeTruthy();
  const callback=new URL(u.searchParams.get('redirect_to')!);
  expect(callback.pathname).toBe('/auth/callback');
  callback.searchParams.set('error','access_denied');callback.searchParams.set('error_description','Google sign-in was cancelled. Please try again.');
  await route.fulfill({status:302,headers:{location:callback.toString()}});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await expect(page.getByText('Google sign-in was cancelled. Please try again.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});

test("failed signup email delivery explains that the account may not exist and allows retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/auth/v1/signup**", async (route) => {
    calls++;
    expect(route.request().postDataJSON().email).toBe("tester@example.com");
    await route.fulfill({
      status: 500,
      json: { msg: "Error sending confirmation email" },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("  Tester@Example.com ");
  await page.getByLabel("Password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Full name", { exact: true }).fill("Test User");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("new-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(/it may not have been created yet/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(1);
});

test("unconfirmed existing account can request a confirmation email without signup password validation", async ({
  page,
}) => {
  let loginCalls = 0,
    resendCalls = 0;
  await page.route("**/auth/v1/token**", async (route) => {
    loginCalls++;
    expect(route.request().postDataJSON().password).toBe("old-pass");
    await route.fulfill({
      status: 400,
      headers: {
        "x-supabase-api-version": "2024-01-01",
        "access-control-expose-headers": "X-Supabase-Api-Version",
      },
      json: { code: "email_not_confirmed", msg: "Email not confirmed" },
    });
  });
  await page.route("**/auth/v1/resend**", async (route) => {
    resendCalls++;
    expect(route.request().postDataJSON()).toMatchObject({
      type: "signup",
      email: "tester@example.com",
    });
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto("/");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("tester@example.com");
  await page.getByLabel("Password", { exact: true }).fill("old-pass");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText(/Confirm your email before signing in/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await expect(page.getByText(/a new link is on its way/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Resend confirmation in/ }),
  ).toBeDisabled();
  expect(loginCalls).toBe(1);
  expect(resendCalls).toBe(1);
});

test("successful signup returns to sign in with explicit confirmation instructions", async ({
  page,
}) => {
  await page.route("**/auth/v1/signup**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "tester@example.com",
        identities: [],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("tester@example.com");
  await page.getByLabel("Password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Full name", { exact: true }).fill("Test User");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("new-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Check tester@example.com for a confirmation link/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /Resend confirmation in/ }),
  ).toBeDisabled();
});
