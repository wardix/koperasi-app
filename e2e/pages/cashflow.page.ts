import { Page, Locator } from "@playwright/test";

export class CashflowPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/cashflow");
  }
}
