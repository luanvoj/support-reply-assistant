import { expect, test, type Page } from "@playwright/test";

const sales = {
  email: "sales@example.local",
  password: process.env.E2E_PASSWORD ?? "",
};

async function login(page: Page) {
  if (!sales.password) throw new Error("E2E_PASSWORD is required for authenticated browser tests.");
  await page.goto("/login");
  await page.getByLabel("Email hoặc tên đăng nhập").fill(sales.email);
  await page.getByLabel("Mật khẩu").fill(sales.password);
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  await page.waitForURL("/");
}

test("TC-COMP-01 — sales đăng nhập và mở Dashboard desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("body")).toContainText("Tổng quan");
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("TC-COMP-02 — Dashboard mobile 375px không tràn ngang và có điều hướng cảm ứng", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBeTruthy();
  await expect(page.locator(".bento-sidebar")).toBeVisible();
  await expect(page.locator(".bento-nav-item").first()).toHaveCSS("min-height", "48px");
  await page.screenshot({ path: "test-results/tc-comp-02-mobile-dashboard.png", fullPage: true });
});

test("TC-COMP-03 — Trợ lý mobile 375px giữ composer và nội dung trong viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/assistant");
  await expect(page).toHaveURL(/\/assistant$/);
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBeTruthy();
  await expect(page.locator("input").last()).toBeVisible();
  await page.screenshot({ path: "test-results/tc-comp-03-mobile-assistant.png", fullPage: true });
});

test("TC-COMP-04 — sales nhận 403 thay vì 500 khi gọi API chỉ dành cho admin", async ({ page }) => {
  await login(page);
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/retrieval/settings");
    return { status: response.status, body: await response.json() };
  });
  expect(result.status).toBe(403);
  expect(result.body.code).toBe("FORBIDDEN");
});

test("TC-COMP-05 — route protected chuyển người chưa đăng nhập về login", async ({ page }) => {
  await page.goto("/assistant");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Đăng nhập không gian làm việc" })).toBeVisible();
});
