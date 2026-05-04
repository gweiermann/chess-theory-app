<script setup lang="ts">
import { body } from '~/design/tokens'

interface Props {
  message?: string
  variant?: 'text' | 'skeleton'
  skeletonCount?: number
}

withDefaults(defineProps<Props>(), {
  message: 'Lade Daten…',
  variant: 'text',
  skeletonCount: 3,
})
</script>

<template>
  <div v-if="variant === 'text'" role="status" :class="`${body.muted} py-6 text-center`">
    {{ message }}
  </div>
  <div v-else role="status" class="flex flex-col gap-3" aria-live="polite">
    <span class="sr-only">{{ message }}</span>
    <div
      v-for="row in skeletonCount"
      :key="row"
      data-skeleton-row
      class="h-16 w-full animate-pulse rounded-xl bg-(--ui-bg-elevated)"
    />
  </div>
</template>
