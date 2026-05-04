<script setup lang="ts">
interface Props {
  message: string
  title?: string
}

defineProps<Props>()
</script>

<template>
  <UAlert
    color="error"
    variant="soft"
    icon="i-lucide-alert-triangle"
    :title="title ?? message"
    :description="title ? message : undefined"
  />
</template>
