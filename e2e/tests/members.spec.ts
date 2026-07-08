import { test, expect } from "../fixtures/auth.fixture";
import { MembersPage } from "../pages/members.page";

test.describe("Members Management", () => {
  test("should load members page and perform CRUD actions", async ({ adminPage }) => {
    const membersPage = new MembersPage(adminPage);
    await membersPage.goto();

    // Verify page title
    await expect(adminPage.getByRole("heading", { name: "Data Anggota" })).toBeVisible();

    // Add a new member
    const newMemberName = `John Doe E2E-${Date.now()}`;
    await membersPage.addMember(newMemberName, "Anggota", "500000");

    // Verify member is in table
    const row = membersPage.getRow(newMemberName);
    await expect(row).toBeVisible();
    await expect(row.getByText("Anggota")).toBeVisible();
    await expect(row.getByText("Rp 500.000", { exact: true })).toBeVisible();

    // Edit member
    await membersPage.editMember(newMemberName, "Sekretaris");
    await expect(row.getByText("Sekretaris")).toBeVisible();

    // Update savings (Mutasi Simpanan)
    await membersPage.updateSavings(newMemberName, "150000", "sukarela");
    // totalSavings becomes 500000 + 150000 = 650000
    await expect(row.getByText("Rp 650.000", { exact: true })).toBeVisible();

    // View transaction history
    await membersPage.viewHistory(newMemberName);
    await expect(adminPage.getByRole("heading", { name: "Riwayat Transaksi" })).toBeVisible();
    await expect(adminPage.getByText(`Rekam jejak transaksi simpanan untuk ${newMemberName}`)).toBeVisible();
    // Wait for history table or content to be loaded and close it
    await adminPage.getByRole("button", { name: "Close" }).or(adminPage.locator(".dialog-close-button")).or(adminPage.locator("button[aria-label='Close']")).or(adminPage.getByRole("button", { name: "×" })).first().click();

    // Delete member
    await membersPage.deleteMember(newMemberName);
    await expect(row).not.toBeVisible();
  });
});
