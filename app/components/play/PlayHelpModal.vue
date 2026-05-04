<script setup lang="ts">
import SessionHud from '~/components/SessionHud.vue'
import type { FeedbackPayload } from '~/components/play/feedback-types'
import type { SessionState } from '~/domain/session'
import type { Line } from '~/domain/types'

interface Props {
  open: boolean
  line: Line
  state: SessionState
  lastFeedback: FeedbackPayload | null | undefined
}

defineProps<Props>()

defineEmits<{ (e: 'update:open', value: boolean): void }>()
</script>

<template>
  <UModal :open="open" @update:open="$emit('update:open', $event)">
    <template #content>
      <div class="p-4 sm:p-5">
        <h2 class="mb-3 text-lg font-semibold">{{ line.fullName }}</h2>
        <SessionHud :line="line" :state="state" :last-feedback="lastFeedback" />
      </div>
    </template>
  </UModal>
</template>
