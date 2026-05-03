import type { Page } from '@playwright/test'

export class FamilyTreePage {
  constructor(readonly page: Page) {}

  async goto(topicId: string, familyId: string, query?: string): Promise<void> {
    const q = query ? `?path=${encodeURIComponent(query)}` : ''
    await this.page.goto(`/openings/${topicId}/family/${familyId}${q}`)
    await this.page.waitForLoadState('load')
    await this.page.locator('nav').first().waitFor({ state: 'visible' })
  }

  firstTreeRow(): ReturnType<Page['locator']> {
    return this.page.locator('ul > li').first()
  }

  rowByText(text: string | RegExp): ReturnType<Page['locator']> {
    return this.page.locator('ul > li', { hasText: text }).first()
  }

  async practiceFirstRow(): Promise<void> {
    await this.firstTreeRow().getByRole('button', { name: 'Üben' }).click()
  }

  /** Family root card: primary practice action when the first tree row is a locked sub-line (e.g. Italian). */
  async practiceFamilyRoot(): Promise<void> {
    await this.page.getByRole('button', { name: 'Jetzt üben' }).click()
  }

  async practiceRow(row: ReturnType<Page['locator']>): Promise<void> {
    await row.getByRole('button', { name: 'Üben' }).click()
  }
}
