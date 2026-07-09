import { test, expect } from "../fixtures/auth.fixture";
import { LoansTxPage } from "../pages/loansTx.page";

test.describe("Loan Payments Transactions Management", () => {
  test("should load loan payments transactions page and display records", async ({ adminPage }) => {
    const loansTxPage = new LoansTxPage(adminPage);
    await loansTxPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Riwayat Transaksi Pinjaman", exact: true })).toBeVisible();

    const table = adminPage.locator("table");
    await expect(table).toBeVisible();

    const searchInput = adminPage.getByPlaceholder("Cari transaksi pembayaran...");
    await expect(searchInput).toBeVisible();
  });
});
