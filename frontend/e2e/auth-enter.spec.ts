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
    await page.getByLabel(/^email$/i).fill("enter-signin@example.com");
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
    await page.getByLabel(/mobile number/i).fill("9876543210");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await page.getByLabel(/confirm password/i).fill("Passw0rd!");
    await markFormSubmit(page);
    await page.getByLabel(/confirm password/i).press("Enter");
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __authSubmitted?: boolean }).__authSubmitted))).toBe(true);
  });

  test("sign-in primary button is a submit control and click submits", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel(/^email$/i).fill("click-signin@example.com");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await markFormSubmit(page);
    const submit = page.getByRole("button", { name: /^sign in$/i });
    await expect(submit).toHaveAttribute("type", "submit");
    await submit.click();
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __authSubmitted?: boolean }).__authSubmitted))).toBe(true);
  });

  test("sign-in Enter still finishes when Firebase hangs after Supabase rejects", async ({ page }) => {
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
    await page.route("https://identitytoolkit.googleapis.com/**", async (route) => {
      await route.abort();
    });
    await page.route("**/api/backend/auth/sign-in", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: "app-jwt", user: { id: "u1", email: "enter-signin@example.com" } }),
      });
    });

    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel(/^email$/i).fill("enter-signin@example.com");
    await page.getByLabel(/^password$/i).fill("Passw0rd!");
    await page.getByLabel(/^password$/i).press("Enter");

    await expect.poll(async () => {
      return page.evaluate(() => ({
        token: window.localStorage.getItem("career_copilot_access_token"),
        alert: document.querySelector("[role=alert]")?.textContent ?? "",
        button: document.querySelector("form button[type=submit]")?.textContent?.trim() ?? "",
      }));
    }, { timeout: 15000 }).toMatchObject({ token: "app-jwt" });
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
