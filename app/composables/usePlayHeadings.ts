import { computed, type ComputedRef, type Ref } from 'vue'
import type { CurrentSelection } from '~/infra/selection-repository'
import type { TrainingSession } from '~/composables/training-session'
import { TARGET_REPS } from '~/domain/session'
import type { Line, Topic } from '~/domain/types'

interface UsePlayHeadingsArgs {
  topic: Ref<Topic | null>
  selection: Ref<CurrentSelection | null>
  currentLine: Ref<Line | null>
  session: Ref<TrainingSession | null>
}

export interface UsePlayHeadings {
  focusedFamilyName: ComputedRef<string | null>
  phaseLabel: ComputedRef<string>
  /** Strip everything before and including the first colon so the h1 only shows
   *  the variation name; the family is rendered separately above. */
  displayLineName: ComputedRef<string>
}

export const usePlayHeadings = ({
  topic,
  selection,
  currentLine,
  session,
}: UsePlayHeadingsArgs): UsePlayHeadings => {
  const currentFamily = computed(() => {
    const line = currentLine.value
    const t = topic.value
    if (!line || !t) return null
    return t.families.find((f) => f.lines.some((l) => l.id === line.id)) ?? null
  })

  const focusedFamilyName = computed(() => {
    const sel = selection.value
    const t = topic.value
    if (!sel || !t) return null
    const focus = sel.focus
    if (focus.kind === 'family') {
      return t.families.find((f) => f.id === focus.familyId)?.name ?? null
    }
    return currentFamily.value?.name ?? null
  })

  const phaseLabel = computed(() => {
    const s = session.value?.state.value
    if (!s) return ''
    switch (s.phase) {
      case 'intro':
        return 'Einführung'
      case 'building':
        return `Aufbau · Schritt ${s.currentStep} von ${s.totalSteps}`
      case 'repeating':
        return `Wiederholung · ${s.repsDone + 1} von ${TARGET_REPS}`
      case 'done':
        return 'Fertig'
      default:
        return ''
    }
  })

  const displayLineName = computed(() => {
    const name = currentLine.value?.fullName ?? ''
    const idx = name.indexOf(':')
    return idx === -1 ? name : name.slice(idx + 1).trim()
  })

  return { focusedFamilyName, phaseLabel, displayLineName }
}
