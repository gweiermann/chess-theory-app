<script setup lang="ts">
import PhaseBanner from '~/components/play/PhaseBanner.vue'
import FeedbackBanner from '~/components/play/FeedbackBanner.vue'
import type { FeedbackPayload } from '~/components/play/feedback-types'
import type { SessionState } from '~/domain/session'
import type { Line } from '~/domain/types'

interface Props {
  line: Line
  state: SessionState
  lastFeedback?: FeedbackPayload | null
}

defineProps<Props>()
</script>

<template>
  <UCard class="w-full">
    <template #header>
      <PhaseBanner :line="line" :state="state" />
    </template>
    <FeedbackBanner :feedback="lastFeedback" />
  </UCard>
</template>
