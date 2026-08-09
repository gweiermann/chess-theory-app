<script setup lang="ts">
/**
 * Manual continue surface, shown when a round is complete. Mode-agnostic: it
 * takes the round totals as props and emits `continue` when the user is ready
 * to move on — the same pattern will be reused by the classic drill for its
 * manual round-completion.
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
}

withDefaults(defineProps<Props>(), { buttonLabel: 'Weiter' })

defineEmits<{ (e: 'continue'): void }>()
</script>

<template>
  <div
    class="shrink-0 border-t border-(--ui-border) bg-(--ui-bg)/95 backdrop-blur"
    style="padding-bottom: env(safe-area-inset-bottom)"
    data-testid="play-continue-bar"
  >
    <div class="mx-auto flex max-w-sm flex-col gap-3 px-4 py-4">
      <p class="text-center text-base font-semibold" data-testid="continue-heading">
        Runde {{ roundNumber }} abgeschlossen
      </p>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div class="flex justify-between gap-2">
          <dt class="text-(--ui-text-muted)">Rundenpunkte</dt>
          <dd class="tabular-nums font-medium" data-testid="continue-points">
            {{ pointsEarned }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-(--ui-text-muted)">Bonus</dt>
          <dd class="tabular-nums font-medium" data-testid="continue-bonus">
            +{{ bonus }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-(--ui-text-muted)">Fehler</dt>
          <dd class="tabular-nums font-medium" data-testid="continue-mistakes">
            {{ mistakes }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-(--ui-text-muted)">Hilfe</dt>
          <dd class="tabular-nums font-medium" data-testid="continue-help">
            {{ helpUsed ? 'Ja' : 'Nein' }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-(--ui-text-muted)">Serie</dt>
          <dd class="tabular-nums font-medium" data-testid="continue-streak">
            {{ streak }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-(--ui-text-muted)">Gesamtpunkte</dt>
          <dd class="tabular-nums font-medium" data-testid="continue-total-score">
            {{ totalScore }}
          </dd>
        </div>
      </dl>
      <UButton
        color="primary"
        size="xl"
        block
        icon="i-lucide-arrow-right"
        data-testid="continue-button"
        @click="$emit('continue')"
      >
        {{ buttonLabel }}
      </UButton>
    </div>
  </div>
</template>
