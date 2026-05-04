<script setup lang="ts">
import { computed } from 'vue'
import BaseStatPill from '~/components/base/BaseStatPill.vue'
import type { ResolvedActivityEntry } from '~/composables/useRecentActivity'

interface Props {
  entry: ResolvedActivityEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{ (e: 'resume', entry: ResolvedActivityEntry): void }>()

const relativeTime = computed(() => {
  const diffMs = Date.now() - props.entry.lastPracticedAt
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `vor ${hours} h`
  const days = Math.round(hours / 24)
  return `vor ${days} T`
})

const averageSeconds = computed(() => {
  const ms = props.entry.stats.averageRepDurationMs
  return ms === null ? null : Math.round(ms / 1000)
})
</script>

<template>
  <li
    class="flex flex-col gap-2 border-b border-(--ui-border) p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
  >
    <div class="min-w-0">
      <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
        <span>{{ entry.topicLabel }}</span>
        <span v-if="entry.familyName">· {{ entry.familyName }}</span>
        <span>· {{ relativeTime }}</span>
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
      <div class="mt-2 flex flex-wrap gap-2">
        <BaseStatPill
          icon="i-lucide-repeat"
          label="Wdh."
          :value="entry.stats.repCount"
        />
        <BaseStatPill
          icon="i-lucide-x-circle"
          label="Fehler"
          :value="entry.stats.mistakeCount"
        />
        <BaseStatPill
          v-if="entry.stats.helpCount > 0"
          icon="i-lucide-lightbulb"
          label="Hilfe"
          :value="`${entry.stats.helpCount}×`"
        />
        <BaseStatPill
          v-if="averageSeconds !== null"
          icon="i-lucide-timer"
          label="Ø/Wdh."
          :value="`${averageSeconds}s`"
        />
      </div>
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
        @click="emit('resume', entry)"
      >
        Üben
      </UButton>
    </div>
  </li>
</template>
