import { Page, Locator } from "@playwright/test";

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

export class MembersPage {
  readonly page: Page;
  readonly addMemberButton: Locator;
  readonly nameInput: Locator;
  readonly roleInput: Locator;
  readonly depositInput: Locator;
  readonly saveMemberButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addMemberButton = page.getByRole("button", { name: "Tambah Anggota" });
    this.nameInput = page.getByLabel("Nama Lengkap");
    this.roleInput = page.getByLabel("Jabatan");
    this.depositInput = page.getByLabel("Setoran Awal (Simpanan Pokok) (Rp)");
    this.saveMemberButton = page.getByRole("button", { name: "Simpan Data" });
  }

  async goto() {
    await this.page.goto("/members");
  }

  async addMember(name: string, role: string, deposit: string) {
    await this.addMemberButton.click();
    await this.nameInput.fill(name);
    await this.roleInput.fill(role);
    await this.depositInput.fill(deposit);
    await this.saveMemberButton.click();
  }

  getRow(name: string): Locator {
    // Finds the table row containing the member name
    return this.page.locator("tr").filter({ hasText: name });
  }

  async editMember(name: string, newRole: string) {
    const row = this.getRow(name);
    const button = row.getByRole("button", { name: "Edit" });
    await clickReactElement(button);
    await this.roleInput.fill(newRole);
    await this.page.getByRole("button", { name: "Simpan Perubahan" }).click();
  }

  async updateSavings(name: string, amount: string, type: "sukarela" | "wajib" | "pokok") {
    const row = this.getRow(name);
    const button = row.getByRole("button", { name: "Setor" });
    await clickReactElement(button);
    
    // Select the savings type using custom Selector combobox
    await this.page.getByRole("combobox", { name: "Jenis Simpanan" }).click();
    const label = type === "sukarela" ? "Simpanan Sukarela" : type === "wajib" ? "Simpanan Wajib" : "Simpanan Pokok";
    await this.page.getByRole("option", { name: label }).click();
    
    await this.page.getByLabel("Nominal (Rp)").fill(amount);
    await this.page.getByRole("button", { name: "Simpan", exact: true }).click();
  }

  async deleteMember(name: string) {
    const row = this.getRow(name);
    const button = row.getByRole("button", { name: "Hapus" });
    await clickReactElement(button);
    // Confirm delete in the confirmation dialog
    await this.page.getByRole("dialog").getByRole("button", { name: "Hapus", exact: true }).click();
  }

  async viewHistory(name: string) {
    const row = this.getRow(name);
    const button = row.getByRole("button", { name: "Riwayat" });
    await clickReactElement(button);
  }
}
