<script setup lang="ts">
import { useSlots } from 'vue'
import { body, heading, headerBlock } from '~/design/tokens'

interface Props {
  eyebrow?: string
  title: string
  description?: string
}

defineProps<Props>()

const slots = useSlots()
</script>

<template>
  <header :class="headerBlock">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <p
          v-if="eyebrow"
          data-base-page-header-eyebrow
          :class="heading.eyebrow"
        >
          {{ eyebrow }}
        </p>
        <h1 :class="heading.page">
          {{ title }}
        </h1>
      </div>
      <div v-if="slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="description" :class="`max-w-2xl ${body.muted} sm:text-base`">
      {{ description }}
    </p>
  </header>
</template>
