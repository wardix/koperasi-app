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

export class RolesPage {
  readonly page: Page;
  readonly addAdminButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addAdminButton = page.getByRole("button", { name: "Tambah Pengurus" });
  }

  async goto() {
    await this.page.goto("/roles");
  }

  async addAdmin(name: string, email: string, password?: string, roleLabel: string = "Viewer / Pengawas (Hanya baca data)") {
    await this.addAdminButton.click();
    await this.page.getByLabel("Nama Lengkap").fill(name);
    await this.page.getByLabel("Email").fill(email);
    
    if (password) {
      // Choose Password Lokal
      await this.page.getByRole("combobox", { name: "Metode Autentikasi" }).click();
      await this.page.getByRole("option", { name: "Password Lokal" }).click();
      await this.page.getByLabel("Password Awal").fill(password);
    } else {
      // Choose Google SSO
      await this.page.getByRole("combobox", { name: "Metode Autentikasi" }).click();
      await this.page.getByRole("option", { name: "Google Single Sign-On (SSO)" }).click();
    }
    
    await this.page.getByRole("combobox", { name: "Peran / Hak Akses" }).click();
    await this.page.getByRole("option", { name: roleLabel }).click();
    
    await this.page.getByRole("button", { name: "Simpan Pengurus" }).click();
  }

  getRow(email: string): Locator {
    return this.page.locator("tr").filter({ hasText: email });
  }

  async editRole(email: string, roleLabel: string) {
    const row = this.getRow(email);
    const button = row.getByRole("button", { name: "Ubah Peran" });
    await clickReactElement(button);
    await this.page.getByRole("combobox", { name: "Peran / Hak Akses" }).click();
    await this.page.getByRole("option", { name: roleLabel }).click();
    await this.page.getByRole("button", { name: "Simpan Perubahan" }).click();
  }

  async deleteAdmin(email: string) {
    const row = this.getRow(email);
    const button = row.getByRole("button", { name: "Hapus" });
    await clickReactElement(button);
    await this.page.getByRole("dialog").getByRole("button", { name: "Hapus", exact: true }).click(); // Click confirmation button
  }
}
