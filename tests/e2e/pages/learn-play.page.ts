import type { Locator, Page } from '@playwright/test'
import { parseSanFromBannerText } from '../helpers/banner-san'
import { E2E_MAX_WAIT_MS } from '../helpers/prd-constants'

export class LearnPlayPage {
  constructor(readonly page: Page) {}

  board(): Locator {
    return this.page.locator('cg-board').first()
  }

  async goto(): Promise<void> {
    await this.page.goto('/learn/play')
    await this.page.waitForLoadState('load')
    const ready = this.board()
      .or(this.page.getByRole('heading', { name: 'Noch keine Zugfolge ausgewählt' }))
      .or(this.page.getByText(/Failed to load topic/))
    await ready.first().waitFor({ state: 'visible' })
  }

  phaseLabel(): Locator {
    return this.page.getByTestId('play-phase-label')
  }

  lineId(): Locator {
    return this.page.getByTestId('play-line-id')
  }

  lineHeading(): Locator {
    return this.page.getByTestId('learn-line-heading')
  }

  topicLabel(): Locator {
    return this.page.getByTestId('play-topic-label')
  }

  progress(): Locator {
    return this.page.getByTestId('play-progress')
  }

  actionBar(): Locator {
    return this.page.getByTestId('play-action-bar')
  }

  banner(kind?: string): Locator {
    if (kind) return this.page.locator(`[role="status"][data-banner-kind="${kind}"]`)
    return this.page.locator('[role="status"][data-banner-kind]')
  }

  async readBannerText(kind?: string): Promise<string | null> {
    const loc = kind ? this.banner(kind) : this.banner()
    const inner = loc.locator('.truncate').first()
    if (await inner.count() === 0) return null
    return inner.textContent()
  }

  async readNextSanFromUi(): Promise<string> {
    const tryParse = async (): Promise<string | null> => {
      const t = await this.readBannerText('hint')
      return parseSanFromBannerText(t)
    }
    let san = await tryParse()
    if (san) return san
    const hintButton = this.page.getByRole('button', { name: 'Hilfe' })
    for (let i = 0; i < 40; i += 1) {
      san = await tryParse()
      if (san) return san
      try {
        await hintButton.click({ timeout: 500 })
        await this.page.waitForTimeout(150)
      } catch {
        await this.page.waitForTimeout(80)
      }
      san = await tryParse()
      if (san) return san
    }
    const t = await this.readBannerText('hint')
    throw new Error(`Could not parse SAN from banner: ${t}`)
  }

  async waitBoard(): Promise<void> {
    await this.board().waitFor({ state: 'visible', timeout: E2E_MAX_WAIT_MS })
  }
}
