import type { Page } from '@playwright/test'
import type { Line } from '../../../app/domain/types'

export type WireNode = {
  line?: Line
  children?: WireNode[]
}

export const collectLinesFromWire = (node: WireNode): Line[] => {
  const out: Line[] = []
  if (node.line) out.push(node.line)
  for (const c of node.children ?? []) out.push(...collectLinesFromWire(c))
  return out
}

export const fetchFamilyPayload = async (
  page: Page,
  topicId: string,
  familyId: string,
): Promise<WireNode & { id?: string }> => {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3000'
  const res = await page.request.get(`${base}/data/openings/${topicId}/families/${familyId}.json`)
  if (!res.ok()) throw new Error(`fetch family failed: ${res.status()}`)
  return res.json() as Promise<WireNode & { id?: string }>
}

export const findLineById = async (
  page: Page,
  topicId: string,
  familyId: string,
  lineId: string,
): Promise<Line | null> => {
  const root = await fetchFamilyPayload(page, topicId, familyId)
  return collectLinesFromWire(root).find((l) => l.id === lineId) ?? null
}
