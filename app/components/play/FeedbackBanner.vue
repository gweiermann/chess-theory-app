<script setup lang="ts">
import type { FeedbackPayload } from './feedback-types'

interface Props {
  feedback: FeedbackPayload | null | undefined
}

defineProps<Props>()
</script>

<template>
  <div
    v-if="feedback?.kind === 'wrong'"
    class="text-base text-(--ui-error)"
    aria-live="polite"
  >
    Falsch. <template v-if="feedback.expected">Erwartet: <span class="font-mono">{{ feedback.expected }}</span></template>
    <template v-else-if="feedback.continuations?.length">
      Möglich:
      <span class="font-mono">{{ feedback.continuations.join(', ') }}</span>
    </template>
  </div>
</template>
