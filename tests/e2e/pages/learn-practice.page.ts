import type { Locator, Page } from '@playwright/test'
import { E2E_MAX_WAIT_MS } from '../helpers/prd-constants'

/**
 * Page object for the Random Opening Trainer (/learn/practice). The canonical
 * move hint is the dev bridge (`dev-play-next-san`), and user moves are typed
 * into `dev-play-command-input` — the same pipeline as the physical board.
 */
export class LearnPracticePage {
  constructor(readonly page: Page) {}

  board(): Locator {
    return this.page.locator('cg-board').first()
  }

  async openViaLearnHub(): Promise<void> {
    await this.page.goto('/learn')
    await this.page.getByTestId('mode-card-random').click()
    await this.page.getByTestId('mode-play-button').click()
    await this.page.waitForURL(/\/learn\/practice$/)
    await this.board().waitFor({ state: 'visible', timeout: E2E_MAX_WAIT_MS })
  }

  async gotoDirect(): Promise<void> {
    await this.page.goto('/learn/practice')
    await this.board()
      .or(this.page.getByText(/Noch keine gelernten Eröffnungen/))
      .waitFor({ state: 'visible', timeout: E2E_MAX_WAIT_MS })
  }

  phaseLabel(): Locator {
    return this.page.getByTestId('play-phase-label')
  }

  score(): Locator {
    return this.page.getByTestId('practice-score')
  }

  streak(): Locator {
    return this.page.getByTestId('practice-streak')
  }

  targetLine(): Locator {
    return this.page.getByTestId('practice-target-line')
  }


  round(): Locator {
    return this.page.getByTestId('practice-round')
  }

  continueBar(): Locator {
    return this.page.getByTestId('play-continue-bar')
  }

  continueButton(): Locator {
    return this.page.getByTestId('continue-button')
  }

  continuePoints(): Locator {
    return this.page.getByTestId('continue-points')
  }

  continueMistakes(): Locator {
    return this.page.getByTestId('continue-mistakes')
  }

  devSan(): Locator {
    return this.page.getByTestId('dev-play-next-san')
  }

  /** Live board FEN (dev/e2e only) — asserts the physical board vs the session. */
  devBoardFen(): Locator {
    return this.page.getByTestId('dev-board-fen')
  }

  /** Session node FEN the board is expected to reflect (dev/e2e only). */
  devNodeFen(): Locator {
    return this.page.getByTestId('dev-node-fen')
  }

  /** Current round target identity (dev/e2e only). */
  devTargetId(): Locator {
    return this.page.getByTestId('dev-target-id')
  }

  async submitDevSan(san: string): Promise<void> {
    const input = this.page.getByTestId('dev-play-command-input')
    await input.fill(san)
    await input.press('Enter')
  }

  /**
   * Wait for the next user SAN. When `expectedNot` is given, waits until the
   * hint differs from a previously consumed value (the computer may still be
   * auto-playing after the last submit).
   */
  async readNextSan(expectedNot = ''): Promise<string> {
    await this.devSan().waitFor({ state: 'attached' })
    await this.page.waitForFunction(
      (prev) => {
        const el = document.querySelector('[data-testid="dev-play-next-san"]')
        const t = el?.textContent?.trim() ?? ''
        return t.length > 0 && t !== prev
      },
      expectedNot,
      { timeout: E2E_MAX_WAIT_MS },
    )
    const t = (await this.devSan().textContent())?.trim() ?? ''
    return t.split(',')[0]?.trim() ?? ''
  }
}
