<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  percent: number
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), { size: 'md' })

const safePercent = computed(() => {
  if (Number.isNaN(props.percent)) return 0
  return Math.round(Math.max(0, Math.min(100, props.percent)))
})

const trackHeight = computed(() => (props.size === 'sm' ? 'h-1.5' : 'h-2.5'))
</script>

<template>
  <div
    role="progressbar"
    :aria-valuenow="safePercent"
    aria-valuemin="0"
    aria-valuemax="100"
    class="w-full overflow-hidden rounded-full bg-(--ui-bg-elevated)"
    :class="trackHeight"
  >
    <div
      class="h-full rounded-full bg-(--ui-primary) transition-[width] duration-300 ease-out"
      :style="{ width: `${safePercent}%` }"
    />
  </div>
</template>
