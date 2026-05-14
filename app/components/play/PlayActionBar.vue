<script setup lang="ts">
interface Props {
  /** Hilfe toggle: board hint arrow is visible. */
  hintActive: boolean
  /** Structural lock: Hilfe is not available (e.g. opponent to move, or move-history scrub). */
  hintDisabled: boolean
  canGoBackward: boolean
  canGoForward: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'help' | 'restart' | 'more'): void
  (e: 'step', delta: -1 | 1): void
}>()
</script>

<template>
  <div
    class="mt-auto border-t border-(--ui-border) bg-(--ui-bg)/95 backdrop-blur"
    style="padding-bottom: env(safe-area-inset-bottom)"
    data-testid="play-action-bar"
  >
    <div class="flex items-stretch justify-around">
      <button
        type="button"
        class="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2.5 text-sm font-medium text-(--ui-primary) transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        :class="hintActive && !hintDisabled ? 'bg-(--ui-primary)/12 ring-1 ring-(--ui-primary)/35' : ''"
        :disabled="hintDisabled"
        aria-label="Hilfe"
        :aria-pressed="hintDisabled ? undefined : hintActive"
        @click="$emit('help')"
      >
        <UIcon name="i-lucide-lightbulb" class="h-5 w-5" />
        <span>Hilfe</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-sm font-medium text-(--ui-text-muted) transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:text-(--ui-text)"
        :disabled="!canGoBackward"
        aria-label="Zurück"
        @click="$emit('step', -1)"
      >
        <UIcon name="i-lucide-chevron-left" class="h-5 w-5" />
        <span>Zurück</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-sm font-medium text-(--ui-text-muted) transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:text-(--ui-text)"
        :disabled="!canGoForward"
        aria-label="Vor"
        @click="$emit('step', 1)"
      >
        <UIcon name="i-lucide-chevron-right" class="h-5 w-5" />
        <span>Vor</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-sm font-medium text-(--ui-text-muted) transition-colors hover:text-(--ui-text)"
        aria-label="Neu starten"
        @click="$emit('restart')"
      >
        <UIcon name="i-lucide-rotate-ccw" class="h-5 w-5" />
        <span>Neustart</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-sm font-medium text-(--ui-text-muted) transition-colors hover:text-(--ui-text)"
        aria-label="Mehr"
        @click="$emit('more')"
      >
        <UIcon name="i-lucide-ellipsis" class="h-5 w-5" />
        <span>Mehr</span>
      </button>
    </div>
  </div>
</template>
