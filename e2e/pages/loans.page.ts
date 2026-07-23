import { Page, Locator, expect } from "@playwright/test";

async function clickReactElement(locator: Locator) {
  await locator.evaluate(el => {
    const keys = Object.keys(el);
    const reactPropsKey = keys.find(key => key.startsWith('__reactProps$') || key.startsWith('__reactEvents$'));
    if (reactPropsKey) {
      const props = (el as any)[reactPropsKey];
      if (props && typeof props.onClick === 'function') {
        props.onClick({ preventDefault: () => {}, stopPropagation: () => {} });
      }
    }
  });
}

export class LoansPage {
  readonly page: Page;
  readonly addLoanButton: Locator;
  readonly memberSearchInput: Locator;
  readonly amountInput: Locator;
  readonly tenorInput: Locator;
  readonly purposeInput: Locator;
  readonly saveLoanButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addLoanButton = page.getByRole("button", { name: "Tambah Pengajuan" });
    this.memberSearchInput = page.getByPlaceholder("Cari anggota...");
    this.amountInput = page.getByLabel("Jumlah Pinjaman (Rp)");
    this.tenorInput = page.getByLabel("Tenor (Bulan)");
    this.purposeInput = page.getByLabel("Tujuan Pinjaman");
    this.saveLoanButton = page.getByRole("button", { name: "Simpan", exact: true });
  }

  async goto() {
    await this.page.goto("/loans");
  }

  async addLoan(memberName: string, amount: string, tenor: string, purpose: string) {
    await this.addLoanButton.click();
    
    // Typeahead: type member name and select it
    await this.memberSearchInput.fill(memberName);
    // Find the option containing the member name and click it
    await this.page.locator(`text=${memberName}`).first().click();

    await this.amountInput.fill(amount);
    await this.tenorInput.fill(tenor);
    await this.purposeInput.fill(purpose);
    
    await this.saveLoanButton.click();
  }

  getRow(borrowerName: string): Locator {
    return this.page.locator("tr").filter({ hasText: borrowerName });
  }

  async approveLoan(borrowerName: string, interestRate?: string) {
    const row = this.getRow(borrowerName);
    const button = row.getByRole("button", { name: "Setujui" });
    await clickReactElement(button);
    if (interestRate != null) {
      await this.page.getByLabel("Biaya Admin (% per tahun)").fill(interestRate);
    }
    await this.page.getByRole("button", { name: "Setujui & Catat Pencairan" }).click();
  }

  async rejectLoan(borrowerName: string) {
    const row = this.getRow(borrowerName);
    const button = row.getByRole("button", { name: "Tolak" });
    await clickReactElement(button);
  }

  async payInstallment(borrowerName: string, amount: string) {
    const row = this.getRow(borrowerName);
    const button = row.getByRole("button", { name: "Detail" });
    await clickReactElement(button);
    
    await this.page.getByLabel("Nominal Pembayaran (Rp)").fill(amount);
    await this.page.getByRole("button", { name: "Bayar" }).click();
    
    // Wait for the input to be cleared (indicating success and refetch)
    await expect(this.page.getByLabel("Nominal Pembayaran (Rp)")).toHaveValue("");
    
    await this.page.getByRole("button", { name: "Close" }).or(this.page.locator(".dialog-close-button")).or(this.page.locator("button[aria-label='Close']")).or(this.page.getByRole("button", { name: "×" })).first().click(); // Close dialog
  }

  async deleteLoan(borrowerName: string) {
    const row = this.getRow(borrowerName);
    const button = row.getByRole("button", { name: "Hapus" });
    await clickReactElement(button);
    await this.page.getByRole("dialog").getByRole("button", { name: "Hapus", exact: true }).click();
  }

  async cancelDeleteLoan(borrowerName: string) {
    const row = this.getRow(borrowerName);
    const button = row.getByRole("button", { name: "Hapus" });
    await clickReactElement(button);
    await this.page.getByRole("dialog").getByRole("button", { name: "Batal", exact: true }).click();
  }
}
