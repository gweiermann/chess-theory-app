import { ref, type Ref } from 'vue'
import type { CurrentSelection } from '~/infra/selection-repository'

interface SelectionState {
  selection: Ref<CurrentSelection | null>
  set: (next: CurrentSelection) => void
  clear: () => void
  refresh: () => void
}

let cached: SelectionState | null = null

export const useCurrentSelection = (): SelectionState => {
  if (cached) return cached

  const { $repositories } = useNuxtApp()
  const selection = ref<CurrentSelection | null>($repositories.selection.get())

  const set = (next: CurrentSelection): void => {
    $repositories.selection.set(next)
    selection.value = next
  }

  const clear = (): void => {
    $repositories.selection.clear()
    selection.value = null
  }

  const refresh = (): void => {
    selection.value = $repositories.selection.get()
  }

  cached = { selection, set, clear, refresh }
  return cached
}
