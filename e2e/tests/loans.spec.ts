import { test, expect } from "../fixtures/auth.fixture";
import { LoansPage } from "../pages/loans.page";
import { MembersPage } from "../pages/members.page";

test.describe("Loans Management", () => {
  test("should handle loan application, approval, and repayment", async ({ adminPage }) => {
    // 1. Create a member to associate with the loan
    const membersPage = new MembersPage(adminPage);
    await membersPage.goto();
    const loanMemberName = `Borrower E2E-${Date.now()}`;
    await membersPage.addMember(loanMemberName, "Anggota", "1000000");

    // 2. Go to loans page
    const loansPage = new LoansPage(adminPage);
    await loansPage.goto();
    await expect(adminPage.getByRole("heading", { name: "Persetujuan Pinjaman" })).toBeVisible();

    // 3. Add a new loan pengajuan
    const loanAmount = "2000000";
    const tenor = "12";
    const purpose = "Modal Usaha Sembako";
    await loansPage.addLoan(loanMemberName, loanAmount, tenor, purpose);

    // Verify it is created as Menunggu
    const row = loansPage.getRow(loanMemberName);
    await expect(row).toBeVisible();
    await expect(row.getByText("Menunggu")).toBeVisible();
    await expect(row.getByText("Rp 2.000.000")).toBeVisible();

    // 4. Approve the loan
    await loansPage.approveLoan(loanMemberName);
    await adminPage.waitForTimeout(2000);
    await expect(row.getByText("Disetujui")).toBeVisible();

    // 5. Pay installment
    // Total Amount with annuity interest (default bungaPinjaman: 18% p.a., monthly payment = 183,360, total = 2,200,320)
    // Sisa should start with Rp 2.200.320
    await expect(row.getByText("Sisa: Rp 2.200.320")).toBeVisible();
    
    // Pay 500,000
    await loansPage.payInstallment(loanMemberName, "500000");
    
    // Verify updated remaining debt: 2,200,320 - 500,000 = 1,700,320
    await expect(row.getByText("Sisa: Rp 1.700.320")).toBeVisible();

    // 6. Cancel deletion and verify UI is NOT frozen
    await loansPage.cancelDeleteLoan(loanMemberName);
    await adminPage.getByRole("button", { name: "Dasbor" }).click();
    await expect(adminPage.getByRole("heading", { name: "Tren Pertumbuhan Koperasi" })).toBeVisible();
    
    // Go back to loans page to delete
    await loansPage.goto();

    // 7. Delete the loan
    await loansPage.deleteLoan(loanMemberName);
    await expect(row).not.toBeVisible();
  });
});
