import { test, expect } from "../fixtures/auth.fixture";
import { ShuPage } from "../pages/shu.page";

test.describe("SHU Calculation", () => {
  test("should load SHU dashboard and switch years", async ({ adminPage }) => {
    const shuPage = new ShuPage(adminPage);
    await shuPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Kalkulasi Sisa Hasil Usaha (SHU)" })).toBeVisible();

    // Verify presence of summary card headings
    await expect(shuPage.getSummaryCard("Total Pendapatan")).toBeVisible();
    await expect(shuPage.getSummaryCard("Biaya Operasional")).toBeVisible();
    await expect(shuPage.getSummaryCard("SHU Netto")).toBeVisible();

    // Select a year (e.g. current year)
    const currentYear = new Date().getFullYear().toString();
    await shuPage.selectYear(currentYear);

    // Verify pie chart or other data elements are rendered
    await expect(adminPage.locator("text=Distribusi SHU")).toBeVisible();
    await expect(adminPage.locator("text=Rincian Distribusi")).toBeVisible();
  });
});
