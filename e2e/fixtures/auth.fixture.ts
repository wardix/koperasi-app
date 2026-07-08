import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/login.page";

export const test = base.extend<{
  adminPage: any;
}>({
  adminPage: async ({ page }, use) => {
    page.on("console", msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", err => {
      console.error(`[Browser PageError] ${err.message}`);
    });
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("admin@koperasi.com", "admin123");
    // Wait until dashboard is loaded
    await page.getByRole("heading", { name: "Tren Pertumbuhan Koperasi" }).waitFor({ state: "visible", timeout: 10000 });
    await use(page);
  }
});

export { expect } from "@playwright/test";
