<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useOpeningsIndex } from '~/composables/useOpeningsIndex'
import type { TopicSummary } from '~/domain/data/split-dataset'

interface FamilyMastery {
  total: number
  mastered: number
}

const { index, loading, error, load } = useOpeningsIndex()
const { $repositories } = useNuxtApp()
const masteryByTopic = ref<Map<string, FamilyMastery>>(new Map())

const readMasteredLineIds = (topicId: string): Set<string> => {
  const set = new Set<string>()
  if (typeof window === 'undefined') return set
  try {
    const raw = window.localStorage.getItem('chess-theory:v1:progress')
    if (!raw) return set
    const shape = JSON.parse(raw) as {
      byTopic?: Record<string, Record<string, { status?: string }>>
    }
    const lines = shape.byTopic?.[topicId] ?? {}
    for (const [lineId, entry] of Object.entries(lines)) {
      if (entry?.status === 'mastered') set.add(lineId)
    }
  } catch {
    // ignore
  }
  return set
}

const refreshMastery = async (): Promise<void> => {
  if (!index.value) return
  const next = new Map<string, FamilyMastery>()
  for (const summary of index.value.topics) {
    const masteredLineIds = readMasteredLineIds(summary.id)
    if (masteredLineIds.size === 0) {
      next.set(summary.id, { total: summary.totalFamilies, mastered: 0 })
      continue
    }
    try {
      const topicData = await $repositories.openings.loadTopic(summary.id)
      const mastered = topicData.families.filter(
        (f) => f.lines.length > 0 && f.lines.every((l) => masteredLineIds.has(l.id)),
      ).length
      next.set(summary.id, { total: topicData.families.length, mastered })
    } catch {
      next.set(summary.id, { total: summary.totalFamilies, mastered: 0 })
    }
  }
  masteryByTopic.value = next
}

onMounted(async () => {
  await load()
  await refreshMastery()
})

const topics = computed<TopicSummary[]>(() => index.value?.topics ?? [])

const masteryFor = (summary: TopicSummary): FamilyMastery =>
  masteryByTopic.value.get(summary.id) ?? {
    total: summary.totalFamilies,
    mastered: 0,
  }
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
    <header class="mb-6 flex flex-col gap-2 sm:mb-10">
      <p class="text-xs uppercase tracking-widest text-(--ui-text-muted)">
        Eröffnungen
      </p>
      <h1 class="text-2xl font-semibold sm:text-4xl">
        Wähle eine Gruppe
      </h1>
      <p class="max-w-2xl text-sm text-(--ui-text-muted) sm:text-base">
        Tipp auf eine Gruppe, um die Eröffnungen zu sehen und gezielt eine
        Zugfolge auszuwählen, die du als Nächstes üben möchtest.
      </p>
    </header>

    <div v-if="loading && !index" class="text-(--ui-text-muted)">
      Lade Eröffnungen…
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error.message"
    />
    <div
      v-else
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
    >
      <NuxtLink
        v-for="topic in topics"
        :key="topic.id"
        :to="`/openings/${encodeURIComponent(topic.id)}`"
        class="block focus:outline-none"
      >
        <UCard
          class="h-full transition active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:shadow-lg"
          :ui="{ root: 'h-full' }"
        >
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-xl font-bold sm:text-2xl">{{ topic.label }}</h2>
              <UBadge variant="soft" color="neutral">
                {{ topic.totalFamilies }} Eröffnungen
              </UBadge>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-(--ui-text-muted)">
              {{ topic.totalLines }} Zugfolgen
            </p>
            <TopicProgress
              :mastered="masteryFor(topic).mastered"
              :total="masteryFor(topic).total"
              size="sm"
              unit-label="Eröffnungen"
            />
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
