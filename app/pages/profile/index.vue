<script setup lang="ts">
import { computed } from 'vue'
import { useProfileSettings } from '~/composables/useProfileSettings'

const { autoPlayParentPrefix } = useProfileSettings()
const autoPlayLabel = computed(() =>
  autoPlayParentPrefix.value ? 'Aktiv' : 'Aus',
)
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
    <header class="mb-6 flex flex-col gap-2 sm:mb-8">
      <p class="text-xs uppercase tracking-widest text-(--ui-text-muted)">
        Profil
      </p>
      <h1 class="text-2xl font-semibold sm:text-4xl">Dein Bereich</h1>
      <p class="text-sm text-(--ui-text-muted) sm:text-base">
        Hier findest du deinen Fortschritt und deine Lernaktivität.
      </p>
    </header>

    <UCard>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold">Aktivität</h2>
          <p class="text-sm text-(--ui-text-muted)">
            Letzte geübte Zugfolgen, Fehler und Wiederholungen ansehen.
          </p>
        </div>
        <UButton
          to="/profile/activity"
          icon="i-lucide-chevron-right"
          trailing
          color="primary"
          variant="soft"
        >
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
        <UButton
          data-testid="profile-toggle-parent-autoplay"
          :color="autoPlayParentPrefix ? 'primary' : 'neutral'"
          variant="soft"
          @click="autoPlayParentPrefix = !autoPlayParentPrefix"
        >
          {{ autoPlayLabel }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>
