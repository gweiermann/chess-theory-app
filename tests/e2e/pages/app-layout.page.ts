import type { Page } from '@playwright/test'

export class AppLayout {
  constructor(readonly page: Page) {}

  async goLearn(): Promise<void> {
    await this.page.getByRole('link', { name: 'Lernen' }).click()
  }

  async goOpenings(): Promise<void> {
    await this.page.getByRole('link', { name: 'Eröffnungen' }).click()
  }

  async goProfile(): Promise<void> {
    await this.page.getByRole('link', { name: 'Profil' }).click()
  }
}
