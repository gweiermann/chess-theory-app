<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import type { Family, FamilyCategory } from '~/domain/types'

const route = useRoute()
const router = useRouter()

const topicId = computed(() => decodeURIComponent(String(route.params.topic)))
const { topic, loading, error } = useTopic(topicId)
const { set: setSelection } = useCurrentSelection()

const progressApi = shallowRef<ReturnType<typeof useTopicProgress> | null>(null)

watch(
  topic,
  async (t) => {
    if (!t) {
      progressApi.value = null
      return
    }
    progressApi.value = useTopicProgress(t)
    await progressApi.value.refresh()
  },
  { immediate: true },
)

const masteredFamilies = computed(() => progressApi.value?.masteredFamilyCount.value ?? 0)
const totalFamilies = computed(() => progressApi.value?.totalFamilyCount.value ?? 0)
const totalLines = computed(() => progressApi.value?.totalLineCount.value ?? 0)
const nextLine = computed(() => progressApi.value?.nextLine.value ?? null)

const searchQuery = ref('')

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

const filteredFamilies = computed<Family[]>(() => {
  const families = topic.value?.families ?? []
  const q = normalize(searchQuery.value.trim())
  if (q.length === 0) return families
  return families.filter((f) => {
    if (normalize(f.name).includes(q)) return true
    return f.lines.some((l) => normalize(l.fullName).includes(q))
  })
})

interface Section {
  id: FamilyCategory
  label: string
  families: Family[]
}

// The three buckets are stable, user-facing and rendered in this order even
// if one of them happens to be empty for a given topic (we hide empties at
// render time instead of filtering here so the UI layer stays declarative).
const sections = computed<Section[]>(() => {
  const bucket: Record<FamilyCategory, Family[]> = {
    opening: [],
    defense: [],
    gambit: [],
  }
  for (const f of filteredFamilies.value) {
    bucket[f.category].push(f)
  }
  return [
    { id: 'opening', label: 'Eröffnungen', families: bucket.opening },
    { id: 'defense', label: 'Verteidigungen', families: bucket.defense },
    { id: 'gambit', label: 'Gambits', families: bucket.gambit },
  ]
})

const totalFiltered = computed(() =>
  sections.value.reduce((sum, s) => sum + s.families.length, 0),
)

const learnTopic = () => {
  if (!topic.value) return
  setSelection({ topicId: topic.value.id, focus: { kind: 'topic' } })
  router.push('/learn')
}

const learnFamily = (family: Family) => {
  if (!topic.value) return
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'family', familyId: family.id },
  })
  router.push('/learn')
}

const openFamily = (family: Family) => {
  if (!topic.value) return
  router.push(
    `/openings/${encodeURIComponent(topic.value.id)}/family/${encodeURIComponent(family.id)}`,
  )
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
    <NuxtLink
      to="/openings"
      class="mb-4 inline-flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text) sm:mb-6"
    >
      <UIcon name="i-lucide-chevron-left" />
      Eröffnungen
    </NuxtLink>

    <div v-if="loading && !topic" class="text-(--ui-text-muted)">Lade Thema…</div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error.message"
    />
    <UAlert
      v-else-if="!topic"
      color="warning"
      variant="soft"
      :title="`Unbekanntes Thema: ${topicId}`"
    />

    <template v-else>
      <header class="mb-6 flex flex-col gap-3 sm:mb-8">
        <h1 class="text-2xl font-semibold sm:text-4xl">
          {{ topic.label }}
        </h1>
        <p class="text-sm text-(--ui-text-muted) sm:text-base">
          {{ totalFamilies }} Eröffnungen · {{ totalLines }} Zugfolgen
        </p>
        <TopicProgress
          :mastered="masteredFamilies"
          :total="totalFamilies"
          unit-label="Eröffnungen"
        />
      </header>

      <div class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center">
        <UButton
          color="primary"
          size="lg"
          icon="i-lucide-play"
          block
          class="sm:w-auto"
          :disabled="!nextLine"
          @click="learnTopic"
        >
          Weiter lernen
        </UButton>
        <p v-if="nextLine" class="text-sm text-(--ui-text-muted)">
          Vorschlag:
          <span class="font-medium text-(--ui-text)">
            {{ nextLine.fullName }}
          </span>
        </p>
        <p v-else class="text-sm text-success">
          Alle Zugfolgen gemeistert.
        </p>
      </div>

      <UInput
        v-model="searchQuery"
        size="lg"
        icon="i-lucide-search"
        placeholder="Eröffnung suchen…"
        class="mb-6 w-full"
        data-testid="openings-search"
      />

      <div
        v-if="totalFiltered === 0"
        class="rounded-xl border border-(--ui-border) bg-(--ui-bg) px-4 py-6 text-center text-sm text-(--ui-text-muted)"
      >
        Keine Eröffnung gefunden für „{{ searchQuery }}".
      </div>

      <div v-else class="flex flex-col gap-6 sm:gap-8">
        <section
          v-for="section in sections"
          v-show="section.families.length > 0"
          :key="section.id"
          :data-section="section.id"
        >
          <h2 class="mb-3 flex items-baseline gap-2 text-lg font-semibold sm:text-xl">
            {{ section.label }}
            <span class="text-xs font-normal text-(--ui-text-muted)">
              {{ section.families.length }}
            </span>
          </h2>
          <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li
              v-for="family in section.families"
              :key="family.id"
            >
              <UCard :ui="{ root: 'h-full' }">
                <div class="flex h-full flex-col gap-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <button
                        type="button"
                        class="block w-full truncate text-left text-base font-semibold sm:text-lg"
                        @click="openFamily(family)"
                      >
                        {{ family.name }}
                      </button>
                      <p class="mt-1 text-xs text-(--ui-text-muted)">
                        {{ family.lines.length }} Zugfolgen
                      </p>
                    </div>
                    <UBadge
                      v-if="progressApi?.isFamilyMastered(family)"
                      color="success"
                      variant="soft"
                      icon="i-lucide-check"
                    >
                      Gemeistert
                    </UBadge>
                    <UBadge v-else variant="soft" color="neutral">
                      Offen
                    </UBadge>
                  </div>
                  <div class="mt-auto flex flex-wrap gap-2">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-lucide-play"
                      :disabled="progressApi?.isFamilyMastered(family)"
                      @click="learnFamily(family)"
                    >
                      Üben
                    </UButton>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-list"
                      @click="openFamily(family)"
                    >
                      Zugfolgen
                    </UButton>
                  </div>
                </div>
              </UCard>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
