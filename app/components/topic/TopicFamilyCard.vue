<script setup lang="ts">
import type { Family } from '~/domain/types'

interface Props {
  family: Family
  mastered: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'open' | 'learn', family: Family): void
}>()
</script>

<template>
  <li class="cursor-pointer" @click="emit('open', family)">
    <UCard
      :ui="{ root: 'h-full transition active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:shadow-md' }"
    >
      <div class="flex h-full flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-base font-semibold sm:text-lg">
              {{ family.name }}
            </p>
            <p class="mt-1 text-xs text-(--ui-text-muted)">
              {{ family.lines.length }} Zugfolgen
            </p>
          </div>
          <UBadge
            v-if="mastered"
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
            :disabled="mastered"
            @click.stop="emit('learn', family)"
          >
            Üben
          </UButton>
        </div>
      </div>
    </UCard>
  </li>
</template>
