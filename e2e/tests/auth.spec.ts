import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";

test.describe("Authentication flow", () => {
  test("should fail login with incorrect credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("wrong@koperasi.com", "wrongpassword");
    
    // Toast or field status message should indicate error
    await expect(page.locator("text=Email atau kata sandi salah. Coba lagi.")).toBeVisible();
  });

  test("should login successfully with admin credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("admin@koperasi.com", "admin123");
    
    // Should display dashboard
    await expect(page.getByRole("heading", { name: "Tren Pertumbuhan Koperasi" })).toBeVisible();
  });

  test("should logout successfully from dashboard", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("admin@koperasi.com", "admin123");
    
    // Wait for Dashboard to be loaded
    await page.getByRole("heading", { name: "Tren Pertumbuhan Koperasi" }).waitFor({ state: "visible" });
    
    // Click logout button
    await page.getByRole("button", { name: "Keluar" }).click();
    
    // Should redirect back to Login screen
    await expect(page.getByRole("heading", { name: "Selamat Datang" })).toBeVisible();
  });
});
