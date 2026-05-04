<script setup lang="ts">
import FamilyChildRow from '~/components/family/FamilyChildRow.vue'
import type { Line, TreeNode } from '~/domain/types'

interface Props {
  children: ReadonlyArray<TreeNode>
  baseMastered: boolean
  isChildMastered: (child: TreeNode) => boolean
  childProgressLabel: (child: TreeNode) => string
  resolveLine: (lineId: string) => Line | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'navigate' | 'practiceLeaf' | 'practiceBranch', child: TreeNode): void
}>()
</script>

<template>
  <ul class="divide-y divide-(--ui-border) overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg)">
    <FamilyChildRow
      v-for="child in children"
      :key="child.label"
      :child="child"
      :base-mastered="baseMastered"
      :child-mastered="isChildMastered(child)"
      :child-progress-label="childProgressLabel(child)"
      :resolve-line="resolveLine"
      @navigate="emit('navigate', $event)"
      @practice-leaf="emit('practiceLeaf', $event)"
      @practice-branch="emit('practiceBranch', $event)"
    />
  </ul>
</template>
