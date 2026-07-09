import { test, expect } from "../fixtures/auth.fixture";
import { NplPage } from "../pages/npl.page";

test.describe("Non-Performing Loans (NPL) Analysis", () => {
  test("should load NPL dashboard page and verify visual components", async ({ adminPage }) => {
    const nplPage = new NplPage(adminPage);
    await nplPage.goto();

    await expect(adminPage.getByRole("heading", { name: "Analisis Kredit Macet / NPL", exact: true })).toBeVisible();

    await expect(adminPage.getByText("Rasio NPL Koperasi")).toBeVisible();
    await expect(adminPage.getByText("Total Kredit Macet")).toBeVisible();
    await expect(adminPage.getByText("Kredit Aktif Sehat")).toBeVisible();
    await expect(adminPage.getByText("Jumlah Akun Macet")).toBeVisible();

    const table = adminPage.locator("table");
    await expect(table).toBeVisible();

    const searchInput = adminPage.getByPlaceholder("Cari anggota bermasalah...");
    await expect(searchInput).toBeVisible();
  });
});
