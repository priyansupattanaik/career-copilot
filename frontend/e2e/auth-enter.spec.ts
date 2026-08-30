import { test, expect } from "@playwright/test";

async function markFormSubmit(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    (window as unknown as { __authSubmitted?: boolean }).__authSubmitted = false;
    document.querySelector("form")?.addEventListener(
      "submit",
      () => {
        (window as unknown as { __authSubmitted?: boolean }).__authSubmitted = true;
      },
      { capture: true },
    );
  });
}

test.describe("Auth Enter key submits the filled form", () => {
  test("sign-in submits when Enter is pressed after email and password", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel(/email, phone, or username/i).fill("enter-signin@example.com");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await markFormSubmit(page);
    await page.getByLabel(/^password$/i).press("Enter");
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __authSubmitted?: boolean }).__authSubmitted))).toBe(true);
    await expect(page.locator("form.auth-card")).toBeVisible();
  });

  test("sign-up submits when Enter is pressed after every field", async ({ page }) => {
    await page.goto("/sign-up", { waitUntil: "networkidle" });
    await page.getByLabel(/full name/i).fill("Alex Morgan");
    await page.getByLabel(/^email$/i).fill("enter-signup@example.com");
    await page.getByLabel(/username/i).fill("enter_signup");
    await page.getByLabel(/mobile number/i).fill("9876543210");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await page.getByLabel(/confirm password/i).fill("Passw0rd!");
    await markFormSubmit(page);
    await page.getByLabel(/confirm password/i).press("Enter");
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __authSubmitted?: boolean }).__authSubmitted))).toBe(true);
  });

  test.describe("create-account viewport fit", () => {
    for (const viewport of [
      { name: "laptop", width: 1440, height: 900 },
      { name: "laptop-short", width: 1366, height: 768 },
      { name: "laptop-hd", width: 1280, height: 720 },
      { name: "tablet", width: 1024, height: 768 },
      { name: "phone", width: 390, height: 844 },
      { name: "phone-small", width: 360, height: 640 },
      { name: "phone-short", width: 320, height: 568 },
    ]) {
      test(`${viewport.name} keeps the complete form visible without page scroll`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/sign-up", { waitUntil: "networkidle" });

        await expect(page.locator(".atlas-auth-signup-card")).toBeVisible();
        await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
        await expect(page.getByText(/Already registered/i)).toBeVisible();
        const inputLayout = await page.locator(".atlas-auth-signup-card").evaluate((card) => {
          const cardRect = card.getBoundingClientRect();
          const inputs = Array.from(card.querySelectorAll("input.field, .phone-national"));
          const phoneCountry = card.querySelector(".phone-country-trigger")?.getBoundingClientRect();
          const phoneNational = card.querySelector(".phone-national")?.getBoundingClientRect();
          return {
            inputsInsideCard: inputs.every((input) => {
              const rect = input.getBoundingClientRect();
              return rect.left >= cardRect.left && rect.right <= cardRect.right;
            }),
            phoneControlsSeparated: Boolean(
              phoneCountry && phoneNational && phoneCountry.right <= phoneNational.left,
            ),
          };
        });
        expect(inputLayout).toEqual({ inputsInsideCard: true, phoneControlsSeparated: true });
        await expect.poll(async () => page.evaluate(() =>
          document.documentElement.scrollHeight <= window.innerHeight + 1,
        )).toBe(true);
      });
    }
  });

  test("sign-in primary button is a submit control and click submits", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel(/email, phone, or username/i).fill("click-signin@example.com");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await markFormSubmit(page);
    const submit = page.getByRole("button", { name: /^sign in$/i });
    await expect(submit).toHaveAttribute("type", "submit");
    await submit.click();
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __authSubmitted?: boolean }).__authSubmitted))).toBe(true);
  });

  test("sign-in Enter falls back to the app auth endpoint after Supabase rejects", async ({ page }) => {
    const authPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") authPosts.push(request.url());
    });
    await page.route("**/auth/v1/token**", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: "invalid_credentials", message: "Invalid login credentials" }),
      });
    });
    await page.route(/\/api\/(?:backend\/)?v?1?\/?auth\/sign-in(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: "app-jwt", user: { id: "u1", email: "enter-signin@example.com" } }),
      });
    });
    await page.route(/\/api\/(?:backend\/)?v?1?\/?me\/bootstrap(?:\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await page.route(/\/api\/(?:backend\/)?v?1?\/?auth\/session(?:\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await page.context().clearCookies();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel(/email, phone, or username/i).fill("enter-signin@example.com");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await page.getByLabel(/^password$/i).press("Enter");

    await expect.poll(async () => {
      return {
        ...(await page.evaluate(() => ({
        token: window.localStorage.getItem("career_copilot_access_token"),
        alert: document.querySelector("[role=alert]")?.textContent ?? "",
        button: document.querySelector("form button[type=submit]")?.textContent?.trim() ?? "",
        }))),
        authPosts: authPosts.join(" | "),
      };
    }, { timeout: 15_000 }).toMatchObject({ token: "app-jwt" });
    expect(authPosts.some((url) => url.includes("/auth/sign-in")), authPosts.join("\n")).toBe(true);
  });

  test("sign-up Enter shows the inbox screen when the provider accepts the account", async ({ page }) => {
    await page.route("**/auth/v1/signup**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "user-1",
          aud: "authenticated",
          email: "alex.ready@gmail.com",
          confirmation_sent_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/sign-up", { waitUntil: "networkidle" });
    await page.getByLabel(/full name/i).fill("Alex Morgan");
    await page.getByLabel(/^email$/i).fill("alex.ready@gmail.com");
    await page.getByLabel(/username/i).fill("alex_ready");
    await page.getByLabel(/mobile number/i).fill("9876543210");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await page.getByLabel(/confirm password/i).fill("Passw0rd!");
    await page.getByLabel(/confirm password/i).press("Enter");

    await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /resend verification email/i })).toBeVisible();
  });

  test("sign-up primary button is a submit control and click submits", async ({ page }) => {
    await page.goto("/sign-up", { waitUntil: "networkidle" });
    await page.getByLabel(/full name/i).fill("Alex Morgan");
    await page.getByLabel(/^email$/i).fill("click-signup@example.com");
    await page.getByLabel(/username/i).fill("click_signup");
    await page.getByLabel(/mobile number/i).fill("9876543210");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await page.getByLabel(/confirm password/i).fill("Passw0rd!");
    await markFormSubmit(page);
    const submit = page.getByRole("button", { name: /create account/i });
    await expect(submit).toHaveAttribute("type", "submit");
    await submit.click();
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __authSubmitted?: boolean }).__authSubmitted))).toBe(true);
  });
});
