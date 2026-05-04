<script setup lang="ts">
interface Props {
  open: boolean
  canGoToPrevious: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'restart' | 'skip' | 'previous'): void
}>()
</script>

<template>
  <UModal :open="open" @update:open="$emit('update:open', $event)">
    <template #content>
      <div class="p-3">
        <h2 class="mb-2 text-sm font-semibold text-(--ui-text-muted)">Aktionen</h2>
        <div class="space-y-1">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            class="w-full justify-start"
            @click="$emit('restart')"
          >
            Neu starten
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-skip-forward"
            class="w-full justify-start"
            @click="$emit('skip')"
          >
            Überspringen
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-corner-up-left"
            :disabled="!canGoToPrevious"
            data-testid="parent-line-button"
            class="w-full justify-start"
            @click="$emit('previous')"
          >
            Vorherige Folge
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
