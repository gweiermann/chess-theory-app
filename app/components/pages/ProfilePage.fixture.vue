<script setup lang="ts">
defineProps<{ autoPlayOn: boolean }>()
</script>

<template>
  <UCard>
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">Aktivität</h2>
        <p class="text-sm text-(--ui-text-muted)">
          Letzte geübte Zugfolgen, Fehler und Wiederholungen ansehen.
        </p>
      </div>
      <UButton icon="i-lucide-chevron-right" trailing color="primary" variant="soft">
        Öffnen
      </UButton>
    </div>
  </UCard>

  <UCard class="mt-4">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">Parent-Zuege automatisch abspielen</h2>
        <p class="text-sm text-(--ui-text-muted)">
          Spielt Zuege bis zur Parent-Grundposition automatisch vor.
        </p>
      </div>
      <UButton :color="autoPlayOn ? 'primary' : 'neutral'" variant="soft">
        {{ autoPlayOn ? 'Aktiv' : 'Aus' }}
      </UButton>
    </div>
  </UCard>
</template>
