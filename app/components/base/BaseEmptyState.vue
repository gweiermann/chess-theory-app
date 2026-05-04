<script setup lang="ts">
import { useSlots } from 'vue'
import { body } from '~/design/tokens'

interface Props {
  icon: string
  title: string
  description?: string
}

defineProps<Props>()

const slots = useSlots()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 py-10 text-center"
  >
    <div
      class="flex h-12 w-12 items-center justify-center rounded-full bg-(--ui-bg-elevated) text-(--ui-text-muted)"
    >
      <UIcon :name="icon" class="h-6 w-6" />
    </div>
    <p class="text-base font-semibold">
      {{ title }}
    </p>
    <p
      v-if="description"
      data-empty-description
      :class="`max-w-md ${body.muted}`"
    >
      {{ description }}
    </p>
    <div v-if="slots.actions" class="mt-2">
      <slot name="actions" />
    </div>
  </div>
</template>
