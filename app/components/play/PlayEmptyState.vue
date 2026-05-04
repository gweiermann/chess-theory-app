<script setup lang="ts">
defineEmits<{ (e: 'goToOpenings'): void }>()
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-6">
    <div class="rounded-xl border border-(--ui-border) p-6 text-center">
      <UIcon
        name="i-lucide-graduation-cap"
        class="mx-auto h-8 w-8 text-(--ui-text-muted)"
      />
      <h1 class="mt-3 text-xl font-semibold">Noch keine Zugfolge ausgewählt</h1>
      <p class="mx-auto mt-2 max-w-md text-sm text-(--ui-text-muted)">
        Wähle in den Eröffnungen eine Gruppe, eine Eröffnung oder eine
        konkrete Zugfolge. Sie erscheint dann hier zum Üben.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        icon="i-lucide-book-open"
        @click="$emit('goToOpenings')"
      >
        Eröffnungen öffnen
      </UButton>
    </div>
  </div>
</template>
