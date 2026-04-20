<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import type { Line } from '~/domain/types'

const route = useRoute()
const router = useRouter()

const topicId = computed(() => decodeURIComponent(String(route.params.topic)))
const familyId = computed(() => decodeURIComponent(String(route.params.family)))

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

const family = computed(() =>
  topic.value?.families.find((f) => f.id === familyId.value) ?? null,
)

const learnLine = (line: Line) => {
  if (!topic.value) return
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'line', lineId: line.id },
  })
  router.push('/learn')
}

const learnFamily = () => {
  if (!topic.value || !family.value) return
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'family', familyId: family.value.id },
  })
  router.push('/learn')
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
    <NuxtLink
      :to="`/openings/${encodeURIComponent(topicId)}`"
      class="mb-4 inline-flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text) sm:mb-6"
    >
      <UIcon name="i-lucide-chevron-left" />
      <span v-if="topic">{{ topic.label }}</span>
      <span v-else>Zurück</span>
    </NuxtLink>

    <div v-if="loading && !topic" class="text-(--ui-text-muted)">Lade Eröffnung…</div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="error.message"
    />
    <UAlert
      v-else-if="!family"
      color="warning"
      variant="soft"
      :title="`Unbekannte Eröffnung: ${familyId}`"
    />

    <template v-else>
      <header class="mb-6 flex flex-col gap-3 sm:mb-8">
        <p class="text-xs uppercase tracking-widest text-(--ui-text-muted)">
          {{ topic?.label }}
        </p>
        <h1 class="text-2xl font-semibold sm:text-4xl">{{ family.name }}</h1>
        <p class="text-sm text-(--ui-text-muted) sm:text-base">
          {{ family.lines.length }} Zugfolgen
        </p>
        <UButton
          color="primary"
          size="lg"
          icon="i-lucide-play"
          block
          class="sm:w-auto"
          :disabled="progressApi?.isFamilyMastered(family)"
          @click="learnFamily"
        >
          Eröffnung üben
        </UButton>
      </header>

      <ul class="divide-y divide-(--ui-border) overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg)">
        <li
          v-for="line in family.lines"
          :key="line.id"
          class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div class="min-w-0">
            <p class="truncate text-sm sm:text-base">
              <span class="mr-1 font-mono text-xs text-(--ui-text-muted)">
                {{ line.eco }}
              </span>
              {{ line.fullName }}
            </p>
            <p class="mt-0.5 text-xs text-(--ui-text-muted)">
              {{ line.sanMoves.length }} Halbzüge
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UBadge
              v-if="progressApi?.isMastered(line.id)"
              color="success"
              variant="soft"
              icon="i-lucide-check"
            >
              Gemeistert
            </UBadge>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-play"
              @click="learnLine(line)"
            >
              Üben
            </UButton>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
