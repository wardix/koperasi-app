import { test, expect } from "../fixtures/auth.fixture";
import { SavingsPage } from "../pages/savings.page";

test.describe("Savings Transactions Management", () => {
  test("should load savings transactions page and display records", async ({ adminPage }) => {
    const savingsPage = new SavingsPage(adminPage);
    await savingsPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Riwayat Transaksi Simpanan", exact: true })).toBeVisible();

    const table = adminPage.locator("table");
    await expect(table).toBeVisible();

    const searchInput = adminPage.getByPlaceholder("Cari transaksi...");
    await expect(searchInput).toBeVisible();
  });
});
