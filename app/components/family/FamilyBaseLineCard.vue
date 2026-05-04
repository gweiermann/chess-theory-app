<script setup lang="ts">
import type { Line } from '~/domain/types'

interface Props {
  label: string
  line: Line | null
  mastered: boolean
}

defineProps<Props>()

const emit = defineEmits<{ (e: 'practice'): void }>()
</script>

<template>
  <div
    class="relative mb-4 overflow-hidden rounded-xl border"
    :class="mastered
      ? 'border-(--ui-success)/40 bg-(--ui-success)/5'
      : 'border-(--ui-primary)/40 bg-(--ui-primary)/8'"
  >
    <div
      class="absolute inset-y-0 left-0 w-1"
      :class="mastered ? 'bg-(--ui-success)' : 'bg-(--ui-primary)'"
    />
    <div class="flex items-center justify-between gap-4 p-3 pl-5 sm:p-4 sm:pl-6">
      <div class="min-w-0">
        <p
          class="text-xs font-semibold uppercase tracking-widest"
          :class="mastered ? 'text-(--ui-success)' : 'text-(--ui-primary)'"
        >
          Grundposition
        </p>
        <p class="mt-0.5 truncate text-sm font-medium sm:text-base">
          {{ line?.fullName ?? label }}
        </p>
        <p v-if="line" class="mt-0.5 text-xs text-(--ui-text-muted)">
          {{ line.sanMoves.length }} Züge
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UBadge
          v-if="mastered"
          color="success"
          variant="soft"
          icon="i-lucide-check"
        >
          Gemeistert
        </UBadge>
        <UButton
          v-if="!mastered"
          size="sm"
          color="primary"
          icon="i-lucide-play"
          @click="emit('practice')"
        >
          Jetzt üben
        </UButton>
        <UButton
          v-else
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          @click="emit('practice')"
        >
          Wiederholen
        </UButton>
      </div>
    </div>
  </div>
</template>
