<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseEmptyState from '~/components/base/BaseEmptyState.vue'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import TopicFamilyGrid from '~/components/topic/TopicFamilyGrid.vue'
import TopicHeader from '~/components/topic/TopicHeader.vue'
import TopicSearchBar from '~/components/topic/TopicSearchBar.vue'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useTopicSearch } from '~/composables/useTopicSearch'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import type { Family } from '~/domain/types'

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

const { searchQuery, sections, totalFiltered } = useTopicSearch(topic)

const isFamilyMastered = (family: Family): boolean =>
  progressApi.value?.isFamilyMastered(family) ?? false

const learnTopic = (): void => {
  if (!topic.value) return
  setSelection({ topicId: topic.value.id, focus: { kind: 'topic' } })
  router.push('/learn/play')
}

const learnFamily = (family: Family): void => {
  if (!topic.value) return
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'family', familyId: family.id },
  })
  router.push('/learn/play')
}

const openFamily = (family: Family): void => {
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

    <BaseLoadingState
      v-if="loading && !topic"
      variant="skeleton"
      :skeleton-count="6"
      message="Lade Thema…"
    />
    <BaseErrorAlert v-else-if="error" :message="error.message" />
    <UAlert
      v-else-if="!topic"
      color="warning"
      variant="soft"
      :title="`Unbekanntes Thema: ${topicId}`"
    />

    <template v-else>
      <TopicHeader
        :label="topic.label"
        :total-families="totalFamilies"
        :total-lines="totalLines"
        :mastered-families="masteredFamilies"
        :next-line="nextLine"
        @continue="learnTopic"
      />

      <TopicSearchBar v-model="searchQuery" class="mb-6" />

      <BaseEmptyState
        v-if="totalFiltered === 0"
        icon="i-lucide-search-x"
        title="Keine Treffer"
        :description="`Keine Eröffnung gefunden für „${searchQuery}“.`"
      />
      <TopicFamilyGrid
        v-else
        :sections="sections"
        :is-mastered="isFamilyMastered"
        @open="openFamily"
        @learn="learnFamily"
      />
    </template>
  </div>
</template>
