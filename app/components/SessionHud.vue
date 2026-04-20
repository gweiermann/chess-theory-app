<script setup lang="ts">
import { computed } from 'vue'
import { TARGET_REPS, type SessionState } from '~/domain/session'
import type { Line } from '~/domain/types'

interface Props {
  line: Line
  state: SessionState
  lastFeedback?: { kind: 'correct' | 'wrong'; played: string; expected?: string } | null
}

const props = defineProps<Props>()

const phaseLabel = computed(() => {
  switch (props.state.phase) {
    case 'building':
      return `Aufbau · Schritt ${props.state.currentStep} von ${props.state.totalSteps}`
    case 'repeating':
      return `Wiederholung ${props.state.repsDone}/${TARGET_REPS}`
    case 'done':
      return 'Geschafft!'
  }
  return ''
})

const repPercent = computed(() => {
  if (props.state.phase === 'building') {
    return Math.round(
      (props.state.currentStep / Math.max(props.state.totalSteps, 1)) * 100,
    )
  }
  return Math.round((props.state.repsDone / TARGET_REPS) * 100)
})

const feedbackTone = computed(() => {
  if (!props.lastFeedback) return 'neutral'
  return props.lastFeedback.kind === 'wrong' ? 'error' : 'success'
})
</script>

<template>
  <UCard class="w-full">
    <template #header>
      <div class="flex flex-col gap-1">
        <p class="text-xs uppercase tracking-wider text-(--ui-text-muted)">
          {{ line.eco }} · {{ line.fullName }}
        </p>
        <h2 class="text-lg font-semibold">
          {{ phaseLabel }}
        </h2>
      </div>
    </template>

    <div class="space-y-4">
      <div
        role="progressbar"
        :aria-valuenow="repPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        class="h-2 w-full overflow-hidden rounded-full bg-(--ui-bg-elevated)"
      >
        <div
          class="h-full rounded-full bg-(--ui-primary) transition-[width] duration-300 ease-out"
          :style="{ width: `${repPercent}%` }"
        />
      </div>

      <div v-if="state.phase !== 'done'" class="flex items-baseline gap-3">
        <span class="text-sm text-(--ui-text-muted)">Nächster Zug</span>
        <span class="font-mono text-base">
          {{ state.expectedSan ?? '–' }}
        </span>
      </div>

      <div v-if="state.phase === 'done'" class="text-success font-medium">
        Zugfolge gemeistert. Weiter zur nächsten.
      </div>

      <div
        v-if="lastFeedback"
        class="text-sm"
        :class="{
          'text-(--ui-error)': feedbackTone === 'error',
          'text-(--ui-success)': feedbackTone === 'success',
        }"
      >
        <template v-if="lastFeedback.kind === 'wrong'">
          Falsch. Erwartet: <span class="font-mono">{{ lastFeedback.expected }}</span>
        </template>
        <template v-else>
          Korrekt: <span class="font-mono">{{ lastFeedback.played }}</span>
        </template>
      </div>
    </div>
  </UCard>
</template>
