import type { Page } from '@playwright/test'

export const seedMasteredLine = async (
  page: Page,
  topicId: string,
  lineId: string,
): Promise<void> => {
  await page.addInitScript(([seedTopicIdRaw, seedLineIdRaw]) => {
    try {
      const seedTopicId = typeof seedTopicIdRaw === 'string' ? seedTopicIdRaw : ''
      const seedLineId = typeof seedLineIdRaw === 'string' ? seedLineIdRaw : ''
      if (!seedTopicId || !seedLineId) return
      const key = 'chess-theory:v1:progress'
      const now = Date.now()
      const existingRaw = window.localStorage.getItem(key)
      const existing = existingRaw
        ? JSON.parse(existingRaw) as { version?: number; byTopic?: Record<string, Record<string, unknown>> }
        : {}
      const byTopic = existing.byTopic ?? {}
      const topicEntries = byTopic[seedTopicId] ?? {}
      topicEntries[seedLineId] = {
        lineId: seedLineId,
        status: 'mastered',
        reps: 5,
        lastPracticedAt: now,
      }
      byTopic[seedTopicId] = topicEntries
      window.localStorage.setItem(key, JSON.stringify({ version: 1, byTopic }))
    } catch {
      /* noop */
    }
  }, [topicId, lineId])
}

export const seedParentAutoplay = async (page: Page, enabled: boolean): Promise<void> => {
  await page.addInitScript(([isEnabledRaw]) => {
    try {
      const isEnabled = Boolean(isEnabledRaw)
      const key = 'chess-theory:v1:profile-settings'
      window.localStorage.setItem(
        key,
        JSON.stringify({ autoPlayParentPrefix: isEnabled }),
      )
    } catch {
      /* noop */
    }
  }, [enabled])
}

export const seedCorruptProgress = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('chess-theory:v1:progress', '{ not json')
  })
}

export const seedActivityGhostLine = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const key = 'chess-theory:v1:progress'
    const ghostLineId = 'ghost-line-id-that-does-not-exist'
    const now = Date.now()
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        byTopic: {
          e4: {
            [ghostLineId]: {
              lineId: ghostLineId,
              status: 'in-progress',
              reps: 0,
              lastPracticedAt: now,
            },
          },
        },
      }),
    )
  })
}
