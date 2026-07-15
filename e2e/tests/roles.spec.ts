import { test, expect } from "../fixtures/auth.fixture";
import { RolesPage } from "../pages/roles.page";

test.describe("Roles & Access Management", () => {
  test("should handle creating, updating, and deleting an administrator", async ({ adminPage }) => {
    const rolesPage = new RolesPage(adminPage);
    await rolesPage.goto();

    // 1. Verify we are on Roles page
    await expect(adminPage.getByRole("heading", { name: "Manajemen Peran & Akses", exact: true })).toBeVisible();

    // 2. Add a new Admin
    const email = `test-admin-${Date.now()}@example.com`;
    const name = `E2E Pengurus-${Date.now()}`;
    await rolesPage.addAdmin(name, email, "SecurePass123", "Admin (Operasional, tanpa hapus/settings)");

    // 3. Verify it is visible in the list
    const row = rolesPage.getRow(email);
    await expect(row).toBeVisible();
    await expect(row.getByText(name)).toBeVisible();
    await expect(row.getByText("Admin", { exact: true })).toBeVisible();
    await expect(row.getByText("Lokal (Password)")).toBeVisible();

    // 4. Edit the Admin's role to Viewer
    await rolesPage.editRole(email, "Viewer / Pengawas (Hanya baca data)");
    await expect(row.getByText("Viewer", { exact: true })).toBeVisible();

    // 5. Delete the Admin
    await rolesPage.deleteAdmin(email);
    await expect(row).not.toBeVisible();
  });
});
