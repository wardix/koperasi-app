import { test, expect } from "../fixtures/auth.fixture";
import { SettingsPage } from "../pages/settings.page";

test.describe("Settings Management", () => {
  test("should update koperasi profile and interest parameters", async ({ adminPage }) => {
    const settingsPage = new SettingsPage(adminPage);
    await settingsPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Konfigurasi Koperasi" })).toBeVisible();

    // 1. Update Profile Settings
    const uniqueKoperasiName = `Koperasi Sejahtera E2E-${Date.now()}`;
    await settingsPage.updateProfile(
      uniqueKoperasiName,
      "Jl. Koperasi Baru No. 10",
      "021-9999-8888",
      "contact@koperasisejahtera.com"
    );

    // Verify Success Toast is shown
    await expect(adminPage.locator("text=Pengaturan berhasil disimpan!")).toBeVisible();

    // Reload or visit settings page again to verify data persisted
    await adminPage.reload();
    await expect(settingsPage.nameInput).toHaveValue(uniqueKoperasiName);
    await expect(settingsPage.addressInput).toHaveValue("Jl. Koperasi Baru No. 10");

    // 2. Update Interest Parameters
    await settingsPage.updateParameters("2.5", "5.0", "1.0");
    await expect(adminPage.locator("text=Pengaturan berhasil disimpan!")).toBeVisible();

    // Verify parameter values persisted
    await adminPage.reload();
    await expect(settingsPage.interestLoanInput).toHaveValue("2.5");
    await expect(settingsPage.interestSavingsInput).toHaveValue("5.0");
  });
});
