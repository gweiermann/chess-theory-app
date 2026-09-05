<script setup lang="ts">
/**
 * Manual continue surface, shown when a round is complete. Mode-agnostic: it
 * takes the round totals as props and emits `continue` when the user is ready
 * to move on — the same pattern will be reused by the classic drill for its
 * manual round-completion.
 *
 * Compact single-row footer: its inner height matches the play action bar so
 * the board region never resizes when the footer swaps.
 */
interface Props {
  roundNumber: number
  /** Raw points earned from correct moves this round (bonus excluded). */
  pointsEarned: number
  mistakes: number
  helpUsed: boolean
  bonus: number
  totalScore: number
  streak: number
  buttonLabel?: string
  /** Prevent advancing after every first-try target has been completed. */
  continueDisabled?: boolean
  /** Optional secondary action (e.g. "Anderes Thema"); hidden when empty. */
  secondaryLabel?: string
}

withDefaults(defineProps<Props>(), {
  buttonLabel: 'Weiter',
  continueDisabled: false,
  secondaryLabel: '',
})

defineEmits<{ (e: 'continue'): void; (e: 'secondary'): void }>()
</script>

<template>
  <div
    class="shrink-0 border-t border-(--ui-border) bg-(--ui-bg)/95 backdrop-blur"
    style="padding-bottom: env(safe-area-inset-bottom)"
    data-testid="play-continue-bar"
  >
    <div class="mx-auto flex h-16 max-w-sm items-center justify-between gap-3 px-2">
      <div class="flex min-w-0 flex-col justify-center gap-0.5">
        <p class="flex items-center gap-1.5">
          <span class="whitespace-nowrap text-sm font-semibold" data-testid="continue-heading">
            Runde {{ roundNumber }}
          </span>
        </p>
        <dl
          class="flex flex-nowrap items-center gap-x-2 gap-y-0 overflow-hidden text-xs text-(--ui-text-muted) tabular-nums whitespace-nowrap"
        >
          <span class="flex items-center gap-0.5">
            <span class="font-semibold text-(--ui-text)" data-testid="continue-points">{{ pointsEarned }}</span>
            P
          </span>
          <span class="flex items-center gap-0.5">
            +<span data-testid="continue-bonus">{{ bonus }}</span>
          </span>
          <span class="flex items-center gap-0.5">
            Fehler&nbsp;<span class="font-medium text-(--ui-text)" data-testid="continue-mistakes">{{ mistakes }}</span>
          </span>
          <span class="flex items-center gap-0.5">
            Serie&nbsp;<span data-testid="continue-streak">{{ streak }}</span>
          </span>
          <span class="flex items-center gap-0.5">
            Gesamt&nbsp;<span class="font-semibold text-(--ui-text)" data-testid="continue-total-score">{{ totalScore }}</span>
          </span>
          <span class="sr-only" data-testid="continue-help">{{ helpUsed ? 'Ja' : 'Nein' }}</span>
        </dl>
      </div>
      <div class="flex shrink-0 flex-col items-stretch gap-1">
        <UButton
          v-if="secondaryLabel"
          color="neutral"
          variant="soft"
          size="xs"
          icon="i-lucide-shuffle"
          data-testid="continue-secondary"
          @click="$emit('secondary')"
        >
          {{ secondaryLabel }}
        </UButton>
        <UButton
          color="primary"
          :size="secondaryLabel ? 'xs' : 'sm'"
          icon="i-lucide-arrow-right"
          :disabled="continueDisabled"
          data-testid="continue-button"
          @click="$emit('continue')"
        >
          {{ buttonLabel }}
        </UButton>
      </div>
    </div>
  </div>
</template>
