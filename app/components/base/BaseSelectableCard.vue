<script setup lang="ts">
import { computed } from 'vue'
import { focusRing } from '~/design/tokens'

interface Props {
  icon: string
  title: string
  description?: string
  badge?: string
  selected: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  description: undefined,
  badge: undefined,
})

const emit = defineEmits<{ (e: 'select'): void }>()

const onClick = (): void => {
  if (props.disabled) return
  emit('select')
}

const wrapperClass = computed(() => {
  if (props.disabled) {
    return 'cursor-not-allowed border-(--ui-border) opacity-50'
  }
  if (props.selected) {
    return 'border-(--ui-primary) bg-(--ui-primary)/5'
  }
  return 'border-(--ui-border) hover:border-(--ui-primary)/50'
})

const iconBoxClass = computed(() =>
  props.selected && !props.disabled
    ? 'bg-(--ui-primary)/15 text-(--ui-primary)'
    : 'bg-(--ui-bg-elevated) text-(--ui-text-muted)',
)

const indicatorOuterClass = computed(() =>
  props.selected && !props.disabled
    ? 'border-(--ui-primary) bg-(--ui-primary)'
    : 'border-(--ui-border)',
)
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="selected"
    :class="[
      'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
      wrapperClass,
      focusRing,
    ]"
    @click="onClick"
  >
    <div
      class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
      :class="iconBoxClass"
    >
      <UIcon :name="icon" class="h-5 w-5" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">{{ title }}</span>
        <UBadge
          v-if="badge"
          color="neutral"
          variant="soft"
          size="xs"
        >
          {{ badge }}
        </UBadge>
      </div>
      <p v-if="description" class="mt-0.5 text-xs text-(--ui-text-muted)">
        {{ description }}
      </p>
    </div>

    <div class="mt-0.5 shrink-0">
      <div
        class="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors"
        :class="indicatorOuterClass"
      >
        <div
          v-if="selected && !disabled"
          class="h-2 w-2 rounded-full bg-white"
        />
      </div>
    </div>
  </button>
</template>
