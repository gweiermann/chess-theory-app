<script setup lang="ts">
import BaseSelectableCard from '~/components/base/BaseSelectableCard.vue'

const MODES = [
  {
    id: 'openings',
    icon: 'i-lucide-book-open',
    title: 'Eröffnungen lernen',
    description: 'Übe Schritt für Schritt ausgewählte Zugfolgen aus deiner Eröffnungsbibliothek.',
    disabled: false,
  },
  {
    id: 'random',
    icon: 'i-lucide-shuffle',
    title: 'Zufallsmodus',
    description: 'Teste dein Gedächtnis mit zufällig ausgewählten Eröffnungen aus allen Themen.',
    disabled: true,
    badge: 'Demnächst',
  },
  {
    id: 'error-trainer',
    icon: 'i-lucide-triangle-alert',
    title: 'Fehlertrainer',
    description: 'Konzentriere dich auf die Züge, bei denen du in der Vergangenheit Fehler gemacht hast.',
    disabled: true,
    badge: 'Demnächst',
  },
]

defineProps<{ selectedMode?: string }>()
</script>

<template>
  <div class="mx-auto w-full max-w-sm px-4 py-6">
    <p class="text-xs font-medium uppercase tracking-widest text-(--ui-text-muted)">Lernen</p>
    <h1 class="mt-1 text-2xl font-bold">Modus wählen</h1>
    <p class="mt-1 text-sm text-(--ui-text-muted)">Wähle, wie du heute üben möchtest.</p>
    <div class="mt-6 flex flex-col gap-3">
      <BaseSelectableCard
        v-for="mode in MODES"
        :key="mode.id"
        :icon="mode.icon"
        :title="mode.title"
        :description="mode.description"
        :badge="mode.badge"
        :selected="mode.id === (selectedMode ?? 'openings')"
        :disabled="mode.disabled"
      />
    </div>
    <div class="mt-8">
      <UButton color="primary" size="xl" block icon="i-lucide-play">Spielen</UButton>
    </div>
  </div>
</template>
