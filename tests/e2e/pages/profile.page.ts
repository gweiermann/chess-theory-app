import type { Page } from '@playwright/test'

export class ProfilePage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/profile')
    await this.page.waitForLoadState('load')
    await this.page.getByRole('heading', { name: 'Dein Bereich' }).waitFor({ state: 'visible' })
  }

  parentAutoplayToggle(): ReturnType<Page['getByTestId']> {
    return this.page.getByTestId('profile-toggle-parent-autoplay')
  }

  async openActivity(): Promise<void> {
    await this.page.getByRole('link', { name: 'Öffnen' }).first().click()
  }
}
