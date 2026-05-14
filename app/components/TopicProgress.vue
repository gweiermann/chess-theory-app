<script setup lang="ts">
import { computed } from 'vue'
import BaseProgressBar from '~/components/base/BaseProgressBar.vue'

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

const percent = computed(() =>
  props.total === 0 ? 0 : Math.round((props.mastered / props.total) * 100),
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-2">
      <span
        class="text-(--ui-text-muted)"
        :class="size === 'sm' ? 'text-sm' : 'text-base'"
      >
        Fortschritt
      </span>
      <span :class="size === 'sm' ? 'text-sm' : 'text-base font-medium'">
        {{ mastered }} / {{ total }}{{ unitLabel ? ` ${unitLabel}` : '' }} · {{ percent }}%
      </span>
    </div>
    <BaseProgressBar :percent="percent" :size="size" />
  </div>
</template>
