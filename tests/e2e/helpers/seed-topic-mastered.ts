import type { Page } from '@playwright/test'
import { collectLinesFromWire, fetchFamilyPayload, type WireNode } from './line-fixtures'

export const seedAllLinesMasteredForTopic = async (
  page: Page,
  topicId: string,
): Promise<void> => {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3000'
  const idxRes = await page.request.get(`${base}/data/openings/${topicId}/index.json`)
  if (!idxRes.ok()) throw new Error(`index ${topicId}: ${idxRes.status()}`)
  const idx = (await idxRes.json()) as { families: Array<{ id: string }> }
  const byTopic: Record<string, Record<string, unknown>> = {}
  const topicEntries: Record<string, unknown> = {}
  const now = Date.now()
  for (const row of idx.families) {
    const fam = await fetchFamilyPayload(page, topicId, row.id)
    const lines = collectLinesFromWire(fam as WireNode)
    for (const line of lines) {
      topicEntries[line.id] = {
        lineId: line.id,
        status: 'mastered',
        reps: 5,
        lastPracticedAt: now,
      }
    }
  }
  byTopic[topicId] = topicEntries
  await page.addInitScript((payload) => {
    window.localStorage.setItem(
      'chess-theory:v1:progress',
      JSON.stringify({ version: 1, byTopic: payload.byTopic }),
    )
  }, { byTopic })
}
