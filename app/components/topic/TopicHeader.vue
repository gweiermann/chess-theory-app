<script setup lang="ts">
import type { Line } from '~/domain/types'

interface Props {
  label: string
  totalFamilies: number
  totalLines: number
  masteredFamilies: number
  nextLine: Line | null
}

defineProps<Props>()

defineEmits<{ (e: 'continue'): void }>()
</script>

<template>
  <header class="mb-6 flex flex-col gap-3 sm:mb-8">
    <h1 class="text-2xl font-semibold sm:text-4xl">{{ label }}</h1>
    <p class="text-sm text-(--ui-text-muted) sm:text-base">
      {{ totalFamilies }} Eröffnungen · {{ totalLines }} Zugfolgen
    </p>
    <TopicProgress
      :mastered="masteredFamilies"
      :total="totalFamilies"
      unit-label="Eröffnungen"
    />
  </header>

  <div class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center">
    <UButton
      color="primary"
      size="lg"
      icon="i-lucide-play"
      block
      class="sm:w-auto"
      :disabled="!nextLine"
      @click="$emit('continue')"
    >
      Weiter lernen
    </UButton>
    <p v-if="nextLine" class="text-sm text-(--ui-text-muted)">
      Vorschlag:
      <span class="font-medium text-(--ui-text)">{{ nextLine.fullName }}</span>
    </p>
    <p v-else class="text-sm text-success">Alle Zugfolgen gemeistert.</p>
  </div>
</template>
