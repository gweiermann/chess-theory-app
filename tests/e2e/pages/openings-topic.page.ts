import type { Page } from '@playwright/test'

export class OpeningsTopicPage {
  constructor(readonly page: Page) {}

  async goto(topicId: string): Promise<void> {
    await this.page.goto(`/openings/${topicId}`)
    await this.page.waitForLoadState('load')
    await this.page.getByTestId('openings-search').waitFor({ state: 'visible' })
    await this.page.locator('[data-section="opening"]').waitFor({ state: 'visible' })
  }

  searchInput(): ReturnType<Page['getByTestId']> {
    return this.page.getByTestId('openings-search')
  }

  continueLearning(): ReturnType<Page['getByRole']> {
    return this.page.getByRole('button', { name: 'Weiter lernen' })
  }

  async openFamilyCard(name: string | RegExp): Promise<void> {
    await this.page.getByRole('listitem').filter({ hasText: name }).first().click()
  }
}
