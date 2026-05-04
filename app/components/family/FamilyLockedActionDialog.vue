<script setup lang="ts">
interface Props {
  open: boolean
  attemptedLabel: string | null
  baseLineName: string
}

defineProps<Props>()

defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'practiceBase' | 'proceedAnyway'): void
}>()
</script>

<template>
  <UModal :open="open" @update:open="$emit('update:open', $event)">
    <template #content>
      <div class="p-4 sm:p-6">
        <div class="mb-5 flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ui-primary)/10"
          >
            <UIcon name="i-lucide-lock" class="text-(--ui-primary)" />
          </div>
          <div>
            <h3 class="font-semibold">Grundvariante noch nicht gemeistert</h3>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              Um <strong class="text-(--ui-text)">„{{ attemptedLabel }}“</strong>
              von der Grundposition zu starten, meistere erst
              <strong class="text-(--ui-text)">„{{ baseLineName }}“</strong>.
            </p>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <UButton
            color="primary"
            icon="i-lucide-play"
            block
            @click="$emit('practiceBase')"
          >
            „{{ baseLineName }}“ jetzt üben
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            block
            @click="$emit('proceedAnyway')"
          >
            Trotzdem ohne Grundposition üben
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
