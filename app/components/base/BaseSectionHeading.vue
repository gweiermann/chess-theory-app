<script setup lang="ts">
import { useSlots } from 'vue'
import { heading } from '~/design/tokens'

interface Props {
  title: string
  eyebrow?: string
  as?: 'h2' | 'h3'
}

withDefaults(defineProps<Props>(), { as: 'h2', eyebrow: undefined })

const slots = useSlots()
</script>

<template>
  <div class="flex items-end justify-between gap-4">
    <div class="flex flex-col gap-1">
      <p v-if="eyebrow" :class="heading.eyebrow">
        {{ eyebrow }}
      </p>
      <component :is="as" :class="heading.section">
        {{ title }}
      </component>
    </div>
    <div v-if="slots.actions" class="shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
