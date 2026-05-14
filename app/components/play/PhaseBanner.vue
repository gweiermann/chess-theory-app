<script setup lang="ts">
import { computed } from 'vue'
import BaseProgressBar from '~/components/base/BaseProgressBar.vue'
import { TARGET_REPS, type SessionState } from '~/domain/session'
import type { Line } from '~/domain/types'
import { heading } from '~/design/tokens'

interface Props {
  line: Line
  state: SessionState
}

const props = defineProps<Props>()

const phaseLabel = computed(() => {
  switch (props.state.phase) {
    case 'intro':
      return 'Grundposition erreichen'
    case 'building':
      return `Aufbau · Schritt ${props.state.currentStep} von ${props.state.totalSteps}`
    case 'repeating':
      return `Wiederholung ${props.state.repsDone}/${TARGET_REPS}`
    case 'done':
      return 'Geschafft!'
  }
  return ''
})

const phasePercent = computed(() => {
  if (props.state.phase === 'intro') {
    const total = Math.max(props.state.prefixPlies, 1)
    return Math.round((props.state.expectedMoveIndex / total) * 100)
  }
  if (props.state.phase === 'building') {
    return Math.round(
      (props.state.currentStep / Math.max(props.state.totalSteps, 1)) * 100,
    )
  }
  return Math.round((props.state.repsDone / TARGET_REPS) * 100)
})

const isDone = computed(() => props.state.phase === 'done')
const expectedSan = computed(() =>
  props.state.phase === 'done' ? null : (props.state.expectedSan ?? '–'),
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <p :class="heading.eyebrow">
        {{ line.eco }} · {{ line.fullName }}
      </p>
      <h2 class="text-lg font-semibold">
        {{ phaseLabel }}
      </h2>
    </div>

    <BaseProgressBar :percent="phasePercent" />

    <div v-if="!isDone" class="flex items-baseline gap-3">
      <span class="text-base text-(--ui-text-muted)">Nächster Zug</span>
      <span class="font-mono text-base">
        {{ expectedSan }}
      </span>
    </div>

    <div v-else class="text-success font-medium">
      Zugfolge gemeistert. Weiter zur nächsten.
    </div>
  </div>
</template>
