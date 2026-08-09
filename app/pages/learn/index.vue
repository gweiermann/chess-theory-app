<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseSelectableCard from '~/components/base/BaseSelectableCard.vue'

const router = useRouter()

type LearningMode = 'openings' | 'random' | 'error-trainer'

interface Mode {
  id: LearningMode
  icon: string
  title: string
  description: string
  disabled: boolean
  badge?: string
}

const modes: Mode[] = [
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
    description: 'Teste dein Gedächtnis mit zufällig ausgewählten gelernten Eröffnungen aus allen Themen.',
    disabled: false,
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

const selectedMode = ref<LearningMode>('openings')

const play = (): void => {
  const route = selectedMode.value === 'random' ? '/learn/practice' : '/learn/play'
  void router.push(route)
}
</script>

<template>
  <div class="mx-auto w-full max-w-sm px-4 py-6">
    <p class="text-xs font-medium uppercase tracking-widest text-(--ui-text-muted)">
      Lernen
    </p>
    <h1 class="mt-1 text-2xl font-bold">Modus wählen</h1>
    <p class="mt-1 text-sm text-(--ui-text-muted)">
      Wähle, wie du heute üben möchtest.
    </p>

    <div class="mt-6 flex flex-col gap-3">
      <BaseSelectableCard
        v-for="mode in modes"
        :key="mode.id"
        :icon="mode.icon"
        :title="mode.title"
        :description="mode.description"
        :badge="mode.badge"
        :selected="selectedMode === mode.id"
        :disabled="mode.disabled"
        :data-testid="`mode-card-${mode.id}`"
        @select="selectedMode = mode.id"
      />
    </div>

    <div class="mt-8">
      <UButton
        color="primary"
        size="xl"
        block
        icon="i-lucide-play"
        data-testid="mode-play-button"
        @click="play"
      >
        Spielen
      </UButton>
    </div>
  </div>
</template>
