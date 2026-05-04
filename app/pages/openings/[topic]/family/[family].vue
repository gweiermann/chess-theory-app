<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseErrorAlert from '~/components/base/BaseErrorAlert.vue'
import BaseLoadingState from '~/components/base/BaseLoadingState.vue'
import FamilyBreadcrumb from '~/components/family/FamilyBreadcrumb.vue'
import FamilyBaseLineCard from '~/components/family/FamilyBaseLineCard.vue'
import FamilyHeader from '~/components/family/FamilyHeader.vue'
import FamilyInfoBanner from '~/components/family/FamilyInfoBanner.vue'
import FamilyTreeList from '~/components/family/FamilyTreeList.vue'
import FamilyLockedActionDialog from '~/components/family/FamilyLockedActionDialog.vue'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import { useFamilyTree } from '~/composables/useFamilyTree'
import { useFamilyNavigation } from '~/composables/useFamilyNavigation'
import { useLockedActions } from '~/composables/useLockedActions'
import type { TreeNode } from '~/domain/types'

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

const pathSegments = computed<string[]>(() => {
  const raw = route.query.path
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return []
  return raw.split('/').map((s) => decodeURIComponent(s))
})

const isLineMastered = (lineId: string): boolean =>
  progressApi.value?.isMastered(lineId) ?? false

const tree = useFamilyTree({
  topic,
  topicId,
  familyId,
  pathSegments,
  isLineMastered,
})

const locked = useLockedActions()

const { navigateInto, learnNode, learnLine, learnChildNode } = useFamilyNavigation({
  topic,
  router,
  setSelection,
  pathSegments,
  topicId,
  familyId,
  currentNode: tree.currentNode,
  nodeLineIds: tree.nodeLineIds,
})

const tryLearnLeaf = (child: TreeNode): void => {
  if (!child.lineId) return
  const lineId = child.lineId
  locked.guard({
    isOpen: tree.isBaseMastered.value,
    label: child.label,
    onProceed: () => learnLine(lineId),
  })
}

const tryLearnBranch = (child: TreeNode): void => {
  locked.guard({
    isOpen: tree.isBaseMastered.value,
    label: child.label,
    onProceed: () => learnChildNode(child),
  })
}

const practiceBaseFromDialog = (): void => {
  locked.reset()
  const lineId = tree.currentNode.value?.lineId
  if (lineId) learnLine(lineId)
}
</script>

<template>
  <div>
    <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <FamilyBreadcrumb :crumbs="tree.breadcrumbs.value" />

      <BaseLoadingState v-if="loading && !topic" message="Lade Eröffnung…" />
      <BaseErrorAlert v-else-if="error" :message="error.message" />
      <UAlert
        v-else-if="!tree.family.value"
        color="warning"
        variant="soft"
        :title="`Unbekannte Eröffnung: ${familyId}`"
      />
      <UAlert
        v-else-if="!tree.currentNode.value"
        color="warning"
        variant="soft"
        title="Knoten nicht gefunden"
      />

      <template v-else-if="tree.currentNode.value">
        <FamilyHeader
          :label="tree.currentNode.value.label"
          :mastered-count="tree.nodeMasteredCount.value"
          :total-lines="tree.nodeLineIds.value.length"
          :is-node-mastered="tree.isNodeMastered.value"
          :is-root="pathSegments.length === 0"
          :intro-hint="tree.currentNode.value.lineId && !tree.isBaseMastered.value
            ? `Startet mit der Grundvariante „${tree.currentNode.value.label}“`
            : null"
          @practice="learnNode"
        />

        <FamilyBaseLineCard
          v-if="tree.currentNode.value.lineId"
          :label="tree.currentNode.value.label"
          :line="tree.baseLine.value"
          :mastered="tree.isBaseMastered.value"
          @practice="learnLine(tree.currentNode.value!.lineId!)"
        />

        <FamilyInfoBanner
          v-if="tree.currentNode.value.lineId
            && !tree.isBaseMastered.value
            && tree.currentNode.value.children.length > 0"
          :base-label="tree.currentNode.value.label"
        />

        <FamilyTreeList
          v-if="tree.currentNode.value.children.length > 0"
          :children="tree.currentNode.value.children"
          :base-mastered="tree.isBaseMastered.value"
          :is-child-mastered="tree.isChildMastered"
          :child-progress-label="tree.childProgressLabel"
          :resolve-line="tree.resolveLine"
          @navigate="navigateInto"
          @practice-leaf="tryLearnLeaf"
          @practice-branch="tryLearnBranch"
        />

        <p
          v-else-if="tree.currentNode.value.children.length === 0 && !tree.currentNode.value.lineId"
          class="text-sm text-(--ui-text-muted)"
        >
          Keine Zugfolgen gefunden.
        </p>
      </template>
    </div>

    <FamilyLockedActionDialog
      :open="locked.showLockedSheet.value"
      :attempted-label="locked.lockedAction.value?.label ?? null"
      :base-line-name="tree.baseLineName.value"
      @update:open="locked.showLockedSheet.value = $event"
      @practice-base="practiceBaseFromDialog"
      @proceed-anyway="locked.confirmProceed"
    />
  </div>
</template>
