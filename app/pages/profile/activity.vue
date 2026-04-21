<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRecentActivity, type ResolvedActivityEntry } from '~/composables/useRecentActivity'
import { useCurrentSelection } from '~/composables/useCurrentSelection'

const router = useRouter()
const { entries, loading, refresh } = useRecentActivity()
const { set: setSelection } = useCurrentSelection()

onMounted(() => refresh(50))

const formatRelative = (ts: number): string => {
  const diffMs = Date.now() - ts
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `vor ${hours} h`
  const days = Math.round(hours / 24)
  return `vor ${days} T`
}

const resume = (entry: ResolvedActivityEntry) => {
  if (!entry.line) return
  setSelection({
    topicId: entry.topicId,
    focus: { kind: 'line', lineId: entry.line.id },
  })
  router.push('/learn')
}

const hasEntries = computed(() => entries.value.length > 0)
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
    <header class="mb-6 flex flex-col gap-2 sm:mb-8">
      <p class="text-xs uppercase tracking-widest text-(--ui-text-muted)">
        Profil · Aktivität
      </p>
      <h1 class="text-2xl font-semibold sm:text-4xl">Zuletzt geübt</h1>
      <p class="text-sm text-(--ui-text-muted) sm:text-base">
        Wechsle schnell zwischen den Zugfolgen, an denen du zuletzt
        gearbeitet hast.
      </p>
    </header>

    <div v-if="loading && !hasEntries" class="text-(--ui-text-muted)">
      Lade Aktivität…
    </div>
    <UAlert
      v-else-if="!hasEntries"
      color="neutral"
      variant="soft"
      icon="i-lucide-history"
      title="Noch nichts geübt"
      description="Sobald du eine Zugfolge übst, taucht sie hier auf."
    />

    <ul v-else class="overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg)">
      <li
        v-for="entry in entries"
        :key="`${entry.topicId}:${entry.lineId}`"
        class="flex flex-col gap-2 border-b border-(--ui-border) p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
            <span>{{ entry.topicLabel }}</span>
            <span v-if="entry.familyName">· {{ entry.familyName }}</span>
            <span>· {{ formatRelative(entry.lastPracticedAt) }}</span>
          </div>
          <p class="mt-1 truncate text-sm sm:text-base">
            <span v-if="entry.line">
              <span class="mr-1 font-mono text-xs text-(--ui-text-muted)">
                {{ entry.line.eco }}
              </span>
              {{ entry.line.fullName }}
            </span>
            <span v-else class="text-(--ui-text-muted)">
              Zugfolge nicht mehr verfügbar
            </span>
          </p>
          <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--ui-text-muted)">
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-repeat" class="h-3.5 w-3.5" />
              <dt class="sr-only">Wiederholungen</dt>
              <dd>{{ entry.stats.repCount }} Wdh.</dd>
            </div>
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-x-circle" class="h-3.5 w-3.5" />
              <dt class="sr-only">Fehler</dt>
              <dd>{{ entry.stats.mistakeCount }} Fehler</dd>
            </div>
            <div v-if="entry.stats.helpCount > 0" class="flex items-center gap-1">
              <UIcon name="i-lucide-lightbulb" class="h-3.5 w-3.5" />
              <dt class="sr-only">Hilfe</dt>
              <dd>{{ entry.stats.helpCount }}× Hilfe</dd>
            </div>
            <div v-if="entry.stats.averageRepDurationMs !== null" class="flex items-center gap-1">
              <UIcon name="i-lucide-timer" class="h-3.5 w-3.5" />
              <dt class="sr-only">Ø Dauer pro Wdh.</dt>
              <dd>Ø {{ Math.round(entry.stats.averageRepDurationMs / 1000) }}s/Wdh.</dd>
            </div>
          </dl>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            v-if="entry.status === 'mastered'"
            color="success"
            variant="soft"
            icon="i-lucide-check"
          >
            Gemeistert
          </UBadge>
          <UBadge v-else color="primary" variant="soft" icon="i-lucide-loader">
            In Arbeit
          </UBadge>
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-play"
            :disabled="!entry.line"
            @click="resume(entry)"
          >
            Üben
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
