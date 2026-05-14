<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div
    class="shrink-0 relative h-16 w-full overflow-hidden"
    style="max-width: 560px; margin-inline: auto;"
    data-testid="play-phase-bar"
  >
    <div class="absolute inset-0 flex items-center px-4">
      <span
        class="flex-1 truncate text-base font-medium text-(--ui-primary)"
        data-testid="play-phase-label"
      >
        {{ label }}
      </span>
    </div>
  </div>
</template>
