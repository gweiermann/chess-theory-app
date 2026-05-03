import type { Page } from '@playwright/test'

export class ActivityPage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/profile/activity')
    await this.page.waitForLoadState('load')
    await this.page.getByRole('heading', { name: 'Zuletzt geübt' }).waitFor({ state: 'visible' })
  }
}
