import { test, expect } from "../fixtures/auth.fixture";
import { CashflowPage } from "../pages/cashflow.page";

test.describe("Cashflow Management", () => {
  test("should load cashflow page, display summary, and ledger list", async ({ adminPage }) => {
    const cashflowPage = new CashflowPage(adminPage);
    await cashflowPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Arus Kas Koperasi", exact: true })).toBeVisible();

    await expect(adminPage.getByText("Total Arus Masuk")).toBeVisible();
    await expect(adminPage.getByText("Total Arus Keluar")).toBeVisible();
    await expect(adminPage.getByText("Saldo Kas Bersih")).toBeVisible();

    const table = adminPage.locator("table");
    await expect(table).toBeVisible();

    const searchInput = adminPage.getByPlaceholder("Cari buku kas...");
    await expect(searchInput).toBeVisible();
  });
});
