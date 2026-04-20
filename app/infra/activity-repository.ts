import {
  aggregateLineStats,
  type ActivityEvent,
  type LineActivityStats,
} from '~/domain/activity'

export interface ActivityRepository {
  append(event: ActivityEvent): Promise<void>
  listByLine(lineId: string): Promise<ActivityEvent[]>
  listAll(): Promise<Record<string, ActivityEvent[]>>
  statsForLine(lineId: string): Promise<LineActivityStats>
  reset(lineId?: string): Promise<void>
}

export const ACTIVITY_STORAGE_KEY = 'chess-theory:v1:activity'
/** Hard cap to keep localStorage from growing unbounded. */
export const PER_LINE_EVENT_CAP = 500

interface StoredShape {
  byLine: Record<string, ActivityEvent[]>
}

const emptyShape = (): StoredShape => ({ byLine: {} })

const readShape = (storage: Storage): StoredShape => {
  const raw = storage.getItem(ACTIVITY_STORAGE_KEY)
  if (!raw) return emptyShape()
  try {
    const parsed = JSON.parse(raw) as Partial<StoredShape>
    if (!parsed || typeof parsed !== 'object' || !parsed.byLine) {
      return emptyShape()
    }
    return { byLine: parsed.byLine as Record<string, ActivityEvent[]> }
  } catch {
    return emptyShape()
  }
}

const writeShape = (storage: Storage, shape: StoredShape): void => {
  storage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(shape))
}

export const createLocalStorageActivityRepository = (
  storage: Storage,
): ActivityRepository => {
  const append = async (event: ActivityEvent): Promise<void> => {
    const shape = readShape(storage)
    const list = shape.byLine[event.lineId] ?? []
    list.push(event)
    if (list.length > PER_LINE_EVENT_CAP) {
      list.splice(0, list.length - PER_LINE_EVENT_CAP)
    }
    shape.byLine[event.lineId] = list
    writeShape(storage, shape)
  }

  const listByLine = async (lineId: string): Promise<ActivityEvent[]> => {
    const shape = readShape(storage)
    return shape.byLine[lineId] ? [...shape.byLine[lineId]] : []
  }

  const listAll = async (): Promise<Record<string, ActivityEvent[]>> => {
    const shape = readShape(storage)
    const out: Record<string, ActivityEvent[]> = {}
    for (const [lineId, events] of Object.entries(shape.byLine)) {
      out[lineId] = [...events]
    }
    return out
  }

  const statsForLine = async (lineId: string): Promise<LineActivityStats> => {
    const events = await listByLine(lineId)
    return aggregateLineStats(lineId, events)
  }

  const reset = async (lineId?: string): Promise<void> => {
    if (lineId === undefined) {
      storage.removeItem(ACTIVITY_STORAGE_KEY)
      return
    }
    const shape = readShape(storage)
    const filtered: Record<string, ActivityEvent[]> = {}
    for (const [k, v] of Object.entries(shape.byLine)) {
      if (k !== lineId) filtered[k] = v
    }
    writeShape(storage, { byLine: filtered })
  }

  return { append, listByLine, listAll, statsForLine, reset }
}
