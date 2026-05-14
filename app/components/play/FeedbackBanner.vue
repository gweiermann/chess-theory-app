<script setup lang="ts">
import { computed } from 'vue'
import type { FeedbackPayload } from './feedback-types'

interface Props {
  feedback: FeedbackPayload | null | undefined
}

const props = defineProps<Props>()

const tone = computed(() => {
  if (!props.feedback) return null
  return props.feedback.kind === 'wrong' ? 'error' : 'success'
})
</script>

<template>
  <div
    v-if="feedback"
    class="text-base"
    :class="{
      'text-(--ui-error)': tone === 'error',
      'text-(--ui-success)': tone === 'success',
    }"
    aria-live="polite"
  >
    <template v-if="feedback.kind === 'wrong'">
      Falsch. Erwartet: <span class="font-mono">{{ feedback.expected }}</span>
    </template>
    <template v-else>
      Korrekt: <span class="font-mono">{{ feedback.played }}</span>
    </template>
  </div>
</template>
