<script setup lang="ts">
import BaseEmptyState from '~/components/base/BaseEmptyState.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import ActivityListItem from '~/components/activity/ActivityListItem.vue'
import type { ResolvedActivityEntry } from '~/composables/useRecentActivity'

interface Props {
  entries: ReadonlyArray<ResolvedActivityEntry>
  loading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'resume', entry: ResolvedActivityEntry): void }>()
</script>

<template>
  <BaseLoadingState
    v-if="props.loading && props.entries.length === 0"
    variant="skeleton"
    :skeleton-count="4"
    message="Lade Aktivität…"
  />
  <BaseEmptyState
    v-else-if="props.entries.length === 0"
    icon="i-lucide-history"
    title="Noch nichts geübt"
    description="Sobald du eine Zugfolge übst, taucht sie hier auf."
  />
  <ul
    v-else
    class="overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg)"
  >
    <ActivityListItem
      v-for="entry in props.entries"
      :key="`${entry.topicId}:${entry.lineId}`"
      :entry="entry"
      @resume="emit('resume', $event)"
    />
  </ul>
</template>
