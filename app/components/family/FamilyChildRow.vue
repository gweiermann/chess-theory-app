<script setup lang="ts">
import type { Line, TreeNode } from '~/domain/types'

interface Props {
  child: TreeNode
  baseMastered: boolean
  childMastered: boolean
  childProgressLabel: string
  /** Resolves a lineId to its Line metadata (for ECO + move count). */
  resolveLine: (lineId: string) => Line | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'navigate' | 'practiceLeaf' | 'practiceBranch', child: TreeNode): void
}>()
</script>

<template>
  <li class="group">
    <!-- Leaf node: line detail row -->
    <template v-if="child.children.length === 0 && child.lineId">
      <div class="flex items-center justify-between gap-4 p-3 sm:p-4">
        <div class="min-w-0">
          <p class="truncate text-sm sm:text-base">
            <span
              v-if="resolveLine(child.lineId)?.eco"
              class="mr-1 font-mono text-xs text-(--ui-text-muted)"
            >
              {{ resolveLine(child.lineId)!.eco }}
            </span>
            {{ child.label }}
          </p>
          <p
            v-if="resolveLine(child.lineId)"
            class="mt-0.5 text-xs text-(--ui-text-muted)"
          >
            {{ resolveLine(child.lineId)!.sanMoves.length }} Züge
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UBadge
            v-if="childMastered"
            color="success"
            variant="soft"
            icon="i-lucide-check"
          >
            Gemeistert
          </UBadge>
          <UButton
            size="xs"
            :color="baseMastered ? 'primary' : 'neutral'"
            variant="soft"
            :icon="baseMastered ? 'i-lucide-play' : 'i-lucide-lock'"
            @click="emit('practiceLeaf', child)"
          >
            Üben
          </UButton>
        </div>
      </div>
    </template>

    <!-- Branch node: navigation row -->
    <template v-else>
      <div class="flex items-center justify-between gap-3 p-3 sm:p-4">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 text-left"
          @click="emit('navigate', child)"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium sm:text-base">{{ child.label }}</p>
            <p class="mt-0.5 text-xs text-(--ui-text-muted)">
              {{ childProgressLabel }} Zugfolgen
            </p>
          </div>
        </button>
        <div class="flex shrink-0 items-center gap-2">
          <UBadge
            v-if="childMastered"
            color="success"
            variant="soft"
            icon="i-lucide-check"
          >
            Gemeistert
          </UBadge>
          <UButton
            v-else
            size="xs"
            :color="baseMastered ? 'primary' : 'neutral'"
            variant="soft"
            :icon="baseMastered ? 'i-lucide-play' : 'i-lucide-lock'"
            @click="emit('practiceBranch', child)"
          >
            Üben
          </UButton>
          <button
            type="button"
            class="flex items-center p-1 text-(--ui-text-muted) hover:text-(--ui-text)"
            @click="emit('navigate', child)"
          >
            <UIcon name="i-lucide-chevron-right" />
          </button>
        </div>
      </div>
    </template>
  </li>
</template>
