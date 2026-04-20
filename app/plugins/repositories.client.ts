import { createLocalStorageProgressRepository } from '~/infra/local-storage-progress-repository'
import {
  createLocalStorageSelectionRepository,
  type SelectionRepository,
} from '~/infra/selection-repository'
import {
  createLocalStorageActivityRepository,
  type ActivityRepository,
} from '~/infra/activity-repository'
import { createHttpOpeningsLoader, type OpeningsLoader } from '~/infra/openings-loader'
import type { ProgressRepository } from '~/infra/progress-repository'
import type { OpeningsDataset, Topic } from '~/domain/types'

export interface AppRepositories {
  openings: OpeningsLoader
  selection: SelectionRepository
  activity: ActivityRepository
  createProgressRepository(
    context: Topic | OpeningsDataset | { topics: readonly Topic[] },
  ): ProgressRepository
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const baseURL = config.app.baseURL || '/'
  const dataBase = `${baseURL.replace(/\/$/, '')}/data/openings`
  const openings = createHttpOpeningsLoader(dataBase)
  const selection = createLocalStorageSelectionRepository(window.localStorage)
  const activity = createLocalStorageActivityRepository(window.localStorage)

  const repositories: AppRepositories = {
    openings,
    selection,
    activity,
    createProgressRepository: (context) =>
      createLocalStorageProgressRepository(window.localStorage, context),
  }

  return {
    provide: {
      repositories,
    },
  }
})
