<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  mastered: number
  total: number
  size?: 'sm' | 'md'
  unitLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  unitLabel: '',
})

const ratio = computed(() => (props.total === 0 ? 0 : props.mastered / props.total))
const percent = computed(() => Math.round(ratio.value * 100))
const trackHeight = computed(() => (props.size === 'sm' ? 'h-1.5' : 'h-2.5'))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-2">
      <span
        class="text-(--ui-text-muted)"
        :class="size === 'sm' ? 'text-xs' : 'text-sm'"
      >
        Fortschritt
      </span>
      <span
        :class="size === 'sm' ? 'text-xs' : 'text-sm font-medium'"
      >
        {{ mastered }} / {{ total }}{{ unitLabel ? ` ${unitLabel}` : '' }} · {{ percent }}%
      </span>
    </div>
    <div
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      class="w-full overflow-hidden rounded-full bg-(--ui-bg-elevated)"
      :class="trackHeight"
    >
      <div
        class="h-full rounded-full bg-(--ui-primary) transition-[width] duration-300 ease-out"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
