<script setup lang="ts">
interface Props {
  label: string
  masteredCount: number
  totalLines: number
  isNodeMastered: boolean
  isRoot: boolean
  introHint: string | null
}

defineProps<Props>()

defineEmits<{ (e: 'practice'): void }>()
</script>

<template>
  <header class="mb-6 flex flex-col gap-3 sm:mb-8">
    <h1 class="text-2xl font-semibold sm:text-4xl">{{ label }}</h1>
    <p class="text-sm text-(--ui-text-muted) sm:text-base">
      {{ masteredCount }} / {{ totalLines }} Zugfolgen gemeistert
    </p>
    <div class="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
      <UButton
        color="primary"
        size="lg"
        icon="i-lucide-play"
        block
        class="sm:w-auto"
        :disabled="isNodeMastered"
        @click="$emit('practice')"
      >
        {{ isRoot ? 'Eröffnung üben' : 'Alle üben' }}
      </UButton>
      <p
        v-if="introHint"
        class="text-xs text-(--ui-text-muted) sm:ml-1"
      >
        {{ introHint }}
      </p>
    </div>
  </header>
</template>
