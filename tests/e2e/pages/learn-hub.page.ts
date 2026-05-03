import type { Page } from '@playwright/test'

export class LearnHubPage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/learn')
    await this.page.waitForLoadState('load')
    await this.page.getByRole('heading', { name: 'Modus wählen' }).waitFor({ state: 'visible' })
  }

  modeCard(mode: 'openings' | 'random' | 'error-trainer'): ReturnType<Page['getByTestId']> {
    return this.page.getByTestId(`mode-card-${mode}`)
  }

  playButton(): ReturnType<Page['getByTestId']> {
    return this.page.getByTestId('mode-play-button')
  }
}
