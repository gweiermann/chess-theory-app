import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { TrainingSession } from './training-session'
import type { Banner } from '~/domain/learn-banner'
import type { Line } from '~/domain/types'

/**
 * Module-level store for the Learn screen. Vue routing unmounts the page
 * component when the user taps another tab in the bottom navigation; without
 * this store the running drill would be lost and the user would be thrown
 * back to the first step on return. Keeping the session in memory (never in
 * localStorage – that is reserved for persisted progress) lets the tab act
 * like a stateful workspace while still surviving a full page navigation.
 */
export interface LearnState {
  currentLine: Ref<Line | null>
  parentLine: ShallowRef<Line | null>
  session: ShallowRef<TrainingSession | null>
  demonstratedSteps: Ref<Set<number>>
  banner: Ref<Banner | null>
  allMastered: Ref<boolean>
  /**
   * Set of line ids whose intro walkthrough has been completed in THIS app
   * session. Once intro is done the app auto-plays the parent prefix on
   * every subsequent reset instead of asking the user to replay it.
   */
  introCompletedLineIds: Ref<Set<string>>
}

let cached: LearnState | null = null

export const useLearnState = (): LearnState => {
  if (cached) return cached
  cached = {
    currentLine: ref<Line | null>(null),
    parentLine: shallowRef<Line | null>(null),
    session: shallowRef<TrainingSession | null>(null),
    demonstratedSteps: ref<Set<number>>(new Set()),
    banner: ref<Banner | null>(null),
    allMastered: ref(false),
    introCompletedLineIds: ref<Set<string>>(new Set()),
  }
  return cached
}

export const clearLearnState = (): void => {
  const state = useLearnState()
  state.currentLine.value = null
  state.parentLine.value = null
  state.session.value = null
  state.demonstratedSteps.value = new Set()
  state.banner.value = null
  state.allMastered.value = false
}
