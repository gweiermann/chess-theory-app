<script setup lang="ts">
interface Props {
  modelValue: string
  placeholder?: string
}

withDefaults(defineProps<Props>(), { placeholder: 'Eröffnung suchen…' })

defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <UInput
    :model-value="modelValue"
    size="lg"
    icon="i-lucide-search"
    :placeholder="placeholder"
    class="w-full"
    data-testid="openings-search"
    @update:model-value="$emit('update:modelValue', String($event))"
  />
</template>
