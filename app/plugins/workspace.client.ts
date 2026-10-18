import { shallowRef } from 'vue'
import { createOpeningLibrary } from '../modules/openings'
import {
  createIndexedDbRepository,
  createMemoryRepository,
} from '../modules/learning'
import type { LearningSnapshot, Catalog } from '../modules/shared'

export default defineNuxtPlugin(() => {
  const base = useRuntimeConfig().app.baseURL
  const library = createOpeningLibrary({ baseUrl: `${base}data` })
  let repository = createIndexedDbRepository()
  const learning = shallowRef<LearningSnapshot | null>(null)
  const catalog = shallowRef<Catalog | null>(null)
  const warning = shallowRef<string | null>(null)
  let initializing: Promise<void> | null = null
  let unsubscribe: (() => void) | null = null
  const refresh = async () => {
    try {
      learning.value = await repository.load()
    } catch {
      warning.value =
        'Dein Fortschritt konnte nicht gelesen werden. Bitte versuche es erneut.'
    }
  }
  const initialize = () => {
    if (initializing) return initializing
    initializing = (async () => {
      try {
        learning.value = await repository.load()
      } catch {
        repository.close()
        repository = createMemoryRepository()
        learning.value = await repository.load()
        warning.value =
          'Speicherung ist in diesem Browser nicht verfügbar. Du kannst üben; der Fortschritt bleibt nur bis zum Neuladen erhalten.'
      }
      unsubscribe?.()
      unsubscribe = repository.subscribe(() => {
        void refresh()
      })
      catalog.value = await library.catalog()
    })().catch((error) => {
      initializing = null
      throw error
    })
    return initializing
  }
  return {
    provide: {
      workspace: {
        library,
        get repository() {
          return repository
        },
        learning,
        catalog,
        warning,
        initialize,
        refresh,
      },
    },
  }
})
