import { Page, Locator } from "@playwright/test";

export class ShuPage {
  readonly page: Page;
  readonly yearSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    this.yearSelect = page.locator("select[aria-label='Pilih tahun']").or(page.getByLabel("Pilih tahun"));
  }

  async goto() {
    await this.page.goto("/shu");
  }

  async selectYear(year: string) {
    await this.yearSelect.selectOption(year);
  }

  getSummaryCard(title: string): Locator {
    return this.page.locator("div").filter({ hasText: title }).first();
  }
}
