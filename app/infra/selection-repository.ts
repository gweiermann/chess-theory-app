import type { SelectionFocus } from '~/domain/select-next-line'

export interface CurrentSelection {
  topicId: string
  focus: SelectionFocus
}

export interface SelectionRepository {
  get(): CurrentSelection | null
  set(selection: CurrentSelection): void
  clear(): void
}

export const SELECTION_STORAGE_KEY = 'chess-theory:v1:selection'

const isValidFocus = (focus: unknown): focus is SelectionFocus => {
  if (!focus || typeof focus !== 'object') return false
  const f = focus as { kind?: unknown }
  if (f.kind === 'topic') return true
  if (f.kind === 'family') {
    return typeof (f as { familyId?: unknown }).familyId === 'string'
  }
  if (f.kind === 'line') {
    const lineFocus = f as { lineId?: unknown; exclusive?: unknown }
    if (typeof lineFocus.lineId !== 'string') return false
    if (
      typeof lineFocus.exclusive !== 'undefined'
      && typeof lineFocus.exclusive !== 'boolean'
    ) return false
    return true
  }
  return false
}

const parse = (raw: string): CurrentSelection | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<CurrentSelection>
    if (!parsed || typeof parsed.topicId !== 'string') return null
    if (!isValidFocus(parsed.focus)) return null
    return { topicId: parsed.topicId, focus: parsed.focus }
  } catch {
    return null
  }
}

export const createLocalStorageSelectionRepository = (
  storage: Storage,
): SelectionRepository => {
  const get = (): CurrentSelection | null => {
    const raw = storage.getItem(SELECTION_STORAGE_KEY)
    return raw ? parse(raw) : null
  }

  const set = (selection: CurrentSelection): void => {
    storage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection))
  }

  const clear = (): void => {
    storage.removeItem(SELECTION_STORAGE_KEY)
  }

  return { get, set, clear }
}
