import { test, expect } from "../fixtures/auth.fixture";
import { ReportsPage } from "../pages/reports.page";

test.describe("Cooperative Reports Generation", () => {
  test("should load reports page, switch types, and show print template", async ({ adminPage }) => {
    const reportsPage = new ReportsPage(adminPage);
    await reportsPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Laporan Koperasi", exact: true })).toBeVisible();

    await expect(adminPage.locator("#printable-report-area")).toBeVisible();

    await adminPage.getByRole("button", { name: "Laporan Mutasi & Simpanan" }).click();
    await expect(adminPage.getByRole("heading", { name: "LAPORAN PORTFOLIO SIMPANAN ANGGOTA" })).toBeVisible();

    await adminPage.getByRole("button", { name: "Laporan Portofolio Pinjaman" }).click();
    await expect(adminPage.getByRole("heading", { name: "LAPORAN KINERJA DAN PORTOFOLIO PINJAMAN" })).toBeVisible();
  });
});
