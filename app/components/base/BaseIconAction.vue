<script setup lang="ts">
import { computed } from 'vue'
import { focusRing } from '~/design/tokens'

interface Props {
  icon: string
  label: string
  disabled?: boolean
  emphasis?: 'primary' | 'secondary'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  emphasis: 'secondary',
})

const emit = defineEmits<{ (e: 'click'): void }>()

const onClick = (): void => {
  if (props.disabled) return
  emit('click')
}

const emphasisClass = computed(() =>
  props.emphasis === 'primary'
    ? 'border-(--ui-primary)/30 bg-(--ui-primary)/10 text-(--ui-primary) hover:bg-(--ui-primary)/20'
    : 'border-(--ui-border) bg-(--ui-bg) text-(--ui-text) hover:bg-(--ui-bg-elevated)',
)
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :disabled="disabled"
    :class="[
      'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50',
      emphasisClass,
      focusRing,
    ]"
    @click="onClick"
  >
    <UIcon :name="icon" class="h-5 w-5" />
  </button>
</template>
