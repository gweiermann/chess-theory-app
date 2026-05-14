<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  icon?: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-full border border-(--ui-border) bg-(--ui-bg) px-3 py-1.5 text-sm text-(--ui-text-muted)"
  >
    <UIcon
      v-if="icon"
      :name="icon"
      class="h-4 w-4 text-(--ui-text-muted)"
    />
    <span>{{ label }}</span>
    <span class="font-medium text-(--ui-text)">{{ value }}</span>
  </div>
</template>
