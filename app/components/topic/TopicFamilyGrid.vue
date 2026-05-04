<script setup lang="ts">
import TopicFamilyCard from '~/components/topic/TopicFamilyCard.vue'
import type { TopicSection } from '~/composables/useTopicSearch'
import type { Family } from '~/domain/types'

interface Props {
  sections: ReadonlyArray<TopicSection>
  isMastered: (family: Family) => boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'open' | 'learn', family: Family): void
}>()
</script>

<template>
  <div class="flex flex-col gap-6 sm:gap-8">
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
        <TopicFamilyCard
          v-for="family in section.families"
          :key="family.id"
          :family="family"
          :mastered="isMastered(family)"
          @open="emit('open', $event)"
          @learn="emit('learn', $event)"
        />
      </ul>
    </section>
  </div>
</template>
