<script setup lang="ts">
import TopicProgress from '~/components/TopicProgress.vue'

interface TopicEntry {
  id: string
  label: string
  familyCount: number
  lineCount: number
  mastered: number
}

defineProps<{ topics: TopicEntry[] }>()
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
    <UCard
      v-for="topic in topics"
      :key="topic.id"
      class="h-full transition"
      :ui="{ root: 'h-full' }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-xl font-bold sm:text-2xl">{{ topic.label }}</h2>
          <UBadge variant="soft" color="neutral">{{ topic.familyCount }} Eröffnungen</UBadge>
        </div>
      </template>
      <div class="space-y-3">
        <p class="text-sm text-(--ui-text-muted)">{{ topic.lineCount }} Zugfolgen</p>
        <TopicProgress
          :mastered="topic.mastered"
          :total="topic.familyCount"
          size="sm"
          unit-label="Eröffnungen"
        />
      </div>
    </UCard>
  </div>
</template>
