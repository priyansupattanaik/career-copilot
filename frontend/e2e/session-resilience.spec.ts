import { test, expect } from "@playwright/test";

const PASSWORD = "Resilience-Pass-1!";

async function seedAccount(request: import("@playwright/test").APIRequestContext) {
  const email = `resilience-${Math.random().toString(36).slice(2, 10)}@example.com`;
  const res = await request.post("/api/backend/auth/sign-up", {
    data: { email, password: PASSWORD, full_name: "Session Resilience" },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return email;
}

async function uiSignIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|onboarding|resume-analysis/, { timeout: 60000 });
}

test.describe("session validation resilience", () => {
  test("transient session-check failure keeps the user signed in", async ({ page, request }) => {
    const email = await seedAccount(request);
    await uiSignIn(page, email);

    await page.route("**/api/backend/auth/session", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "service_unavailable", message: "temporary outage" } }),
      }),
    );

    await page.goto("/settings/account", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /delete my account/i })).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => localStorage.getItem("career_copilot_access_token"))).toBeTruthy();
  });

  test("definitive rejection still signs the user out", async ({ page, request }) => {
    const email = await seedAccount(request);
    await uiSignIn(page, email);

    await page.route("**/api/backend/auth/session", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "invalid_token", message: "expired" } }),
      }),
    );

    await page.goto("/settings/account", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/sign-in/, { timeout: 20000 });
    expect(await page.evaluate(() => localStorage.getItem("career_copilot_access_token"))).toBeNull();
  });
});
