import type { Page } from '@playwright/test'

export class OpeningsIndexPage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/openings')
    await this.page.waitForLoadState('load')
    await this.page.getByRole('heading', { name: 'e4', exact: true }).waitFor({ state: 'visible' })
  }

  async openTopic(topicLabel: string): Promise<void> {
    await this.page.locator(`a[href="/openings/${topicLabel}"]`).first().click()
  }
}
