<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

type LearningMode = 'openings' | 'random' | 'error-trainer'

interface Mode {
  id: LearningMode
  icon: string
  title: string
  description: string
  disabled: boolean
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
    description: 'Teste dein Gedächtnis mit zufällig ausgewählten Eröffnungen aus allen Themen.',
    disabled: true,
  },
  {
    id: 'error-trainer',
    icon: 'i-lucide-triangle-alert',
    title: 'Fehlertrainer',
    description: 'Konzentriere dich auf die Züge, bei denen du in der Vergangenheit Fehler gemacht hast.',
    disabled: true,
  },
]

const selectedMode = ref<LearningMode>('openings')

const play = () => {
  void router.push('/learn/play')
}
</script>

<template>
  <div class="mx-auto w-full max-w-sm px-4 py-6">
    <p class="text-xs font-medium uppercase tracking-widest text-(--ui-text-muted)">Lernen</p>
    <h1 class="mt-1 text-2xl font-bold">Modus wählen</h1>
    <p class="mt-1 text-sm text-(--ui-text-muted)">Wähle, wie du heute üben möchtest.</p>

    <div class="mt-6 flex flex-col gap-3">
      <button
        v-for="mode in modes"
        :key="mode.id"
        type="button"
        :disabled="mode.disabled"
        class="flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors"
        :class="[
          mode.disabled
            ? 'cursor-not-allowed border-(--ui-border) opacity-50'
            : selectedMode === mode.id
              ? 'border-(--ui-primary) bg-(--ui-primary)/5'
              : 'border-(--ui-border) hover:border-(--ui-primary)/50',
        ]"
        :data-testid="`mode-card-${mode.id}`"
        @click="!mode.disabled && (selectedMode = mode.id)"
      >
        <div
          class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          :class="
            selectedMode === mode.id && !mode.disabled
              ? 'bg-(--ui-primary)/15 text-(--ui-primary)'
              : 'bg-(--ui-bg-elevated) text-(--ui-text-muted)'
          "
        >
          <UIcon :name="mode.icon" class="h-5 w-5" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">{{ mode.title }}</span>
            <UBadge
              v-if="mode.disabled"
              color="neutral"
              variant="soft"
              size="xs"
            >
              Demnächst
            </UBadge>
          </div>
          <p class="mt-0.5 text-xs text-(--ui-text-muted)">{{ mode.description }}</p>
        </div>

        <div class="mt-0.5 shrink-0">
          <div
            class="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors"
            :class="
              selectedMode === mode.id && !mode.disabled
                ? 'border-(--ui-primary) bg-(--ui-primary)'
                : 'border-(--ui-border)'
            "
          >
            <div
              v-if="selectedMode === mode.id && !mode.disabled"
              class="h-2 w-2 rounded-full bg-white"
            />
          </div>
        </div>
      </button>
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
