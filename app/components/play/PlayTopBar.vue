<script setup lang="ts">
interface Props {
  topicLabel: string
  familyName: string | null
  masteredCount: number
  totalLineCount: number
  lineHeading: string
  lineId: string
}

defineProps<Props>()

defineEmits<{ (e: 'back'): void }>()
</script>

<template>
  <div class="min-w-0 shrink-0 border-b border-(--ui-border)/50 bg-(--ui-bg)">
    <div class="flex items-center gap-2 px-2 py-2">
      <button
        class="shrink-0 -ml-1 rounded-lg p-1 text-(--ui-text-muted) transition-colors hover:text-(--ui-text)"
        aria-label="Verlassen"
        data-testid="play-back-button"
        @click="$emit('back')"
      >
        <UIcon name="i-lucide-chevron-left" class="h-7 w-7" />
      </button>
      <p
        class="flex-1 truncate text-center text-base text-(--ui-text-muted)"
        data-testid="play-topic-label"
      >
        {{ topicLabel }}<template v-if="familyName"> · {{ familyName }}</template>
      </p>
      <span
        class="shrink-0 tabular-nums text-base text-(--ui-text-muted)"
        data-testid="play-progress"
      >
        {{ masteredCount }}/{{ totalLineCount }}
      </span>
    </div>
    <h1
      class="line-clamp-2 px-4 pb-3 text-center text-xl font-semibold leading-snug"
      data-testid="learn-line-heading"
    >
      {{ lineHeading }}
    </h1>
    <span class="sr-only" data-testid="play-line-id">{{ lineId }}</span>
  </div>
</template>
