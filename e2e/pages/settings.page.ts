import { Page, Locator } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly addressInput: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;
  readonly saveProfileButton: Locator;
  
  readonly interestLoanInput: Locator;
  readonly interestSavingsInput: Locator;
  readonly penaltyInput: Locator;
  readonly saveParameterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Profil Koperasi
    this.nameInput = page.getByLabel("Nama Koperasi");
    this.addressInput = page.getByLabel("Alamat Lengkap");
    this.phoneInput = page.getByLabel("No. Telepon");
    this.emailInput = page.getByLabel("Email Resmi");
    this.saveProfileButton = page.getByRole("button", { name: "Simpan Perubahan" });

    // Parameter Bunga
    this.interestLoanInput = page.getByLabel("Bunga Pinjaman (% per Tahun)");
    this.interestSavingsInput = page.getByLabel("Bunga Simpanan (%)");
    this.penaltyInput = page.getByLabel("Denda Keterlambatan (%)");
    this.saveParameterButton = page.getByRole("button", { name: "Simpan Parameter" });
  }

  async goto() {
    await this.page.goto("/settings");
  }

  async updateProfile(name: string, address: string, phone: string, email: string) {
    await this.nameInput.fill(name);
    await this.addressInput.fill(address);
    await this.phoneInput.fill(phone);
    await this.emailInput.fill(email);
    await this.saveProfileButton.click();
  }

  async updateParameters(loan: string, savings: string, penalty: string) {
    await this.interestLoanInput.fill(loan);
    await this.interestSavingsInput.fill(savings);
    await this.penaltyInput.fill(penalty);
    await this.saveParameterButton.click();
  }
}
