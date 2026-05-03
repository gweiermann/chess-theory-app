<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTopic } from '~/composables/useTopic'
import { useTopicProgress } from '~/composables/useTopicProgress'
import { useCurrentSelection } from '~/composables/useCurrentSelection'
import { findNodeByPath, flattenLineIdsInOrder } from '~/domain/tree'
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

const family = computed(() =>
  topic.value?.families.find((f) => f.id === familyId.value) ?? null,
)

// Parse ?path=Segment1/Segment2 into an array of decoded labels
const pathSegments = computed<string[]>(() => {
  const raw = route.query.path
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return []
  return raw.split('/').map((s) => decodeURIComponent(s))
})

const currentNode = computed<TreeNode | null>(() => {
  const f = family.value
  if (!f) return null
  if (pathSegments.value.length === 0) return f.tree
  return findNodeByPath(f.tree, pathSegments.value)
})

const nodeLineIds = computed<string[]>(() => {
  const node = currentNode.value
  if (!node) return []
  return flattenLineIdsInOrder(node)
})

const nodeMasteredCount = computed<number>(() => {
  const api = progressApi.value
  if (!api) return 0
  return nodeLineIds.value.filter((id) => api.isMastered(id)).length
})

const isNodeMastered = computed(
  () => nodeLineIds.value.length > 0 && nodeMasteredCount.value === nodeLineIds.value.length,
)

// Breadcrumb: each segment is a link to the path up to that point
interface Crumb {
  label: string
  href: string | null
}

const breadcrumbs = computed<Crumb[]>(() => {
  const base = `/openings/${encodeURIComponent(topicId.value)}/family/${encodeURIComponent(familyId.value)}`
  const crumbs: Crumb[] = [
    { label: topic.value?.label ?? topicId.value, href: `/openings/${encodeURIComponent(topicId.value)}` },
    { label: family.value?.name ?? familyId.value, href: pathSegments.value.length > 0 ? base : null },
  ]
  for (let i = 0; i < pathSegments.value.length; i++) {
    const segPath = pathSegments.value
      .slice(0, i + 1)
      .map(encodeURIComponent)
      .join('/')
    const isLast = i === pathSegments.value.length - 1
    crumbs.push({
      label: pathSegments.value[i]!,
      href: isLast ? null : `${base}?path=${segPath}`,
    })
  }
  return crumbs
})

const childProgressLabel = (child: TreeNode): string => {
  const api = progressApi.value
  if (!api) return ''
  const ids = flattenLineIdsInOrder(child)
  if (ids.length === 0) return ''
  const mastered = ids.filter((id) => api.isMastered(id)).length
  return `${mastered} / ${ids.length}`
}

const isChildMastered = (child: TreeNode): boolean => {
  const api = progressApi.value
  if (!api) return false
  const ids = flattenLineIdsInOrder(child)
  return ids.length > 0 && ids.every((id) => api.isMastered(id))
}

const navigateInto = (childLabel: string) => {
  const base = `/openings/${encodeURIComponent(topicId.value)}/family/${encodeURIComponent(familyId.value)}`
  const newPath = [...pathSegments.value, childLabel].map(encodeURIComponent).join('/')
  router.push(`${base}?path=${newPath}`)
}

const learnNode = () => {
  if (!topic.value || nodeLineIds.value.length === 0) return
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'node', lineIds: nodeLineIds.value, prefixLineId: currentNode.value?.lineId },
  })
  router.push('/learn/play')
}

const learnChildNode = (child: TreeNode) => {
  if (!topic.value) return
  const lineIds = flattenLineIdsInOrder(child)
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'node', lineIds, prefixLineId: child.lineId },
  })
  router.push('/learn/play')
}

const learnLine = (lineId: string) => {
  if (!topic.value) return
  setSelection({
    topicId: topic.value.id,
    focus: { kind: 'line', lineId, exclusive: true },
  })
  router.push('/learn/play')
}

// Find the Line object for a lineId
const findLine = (lineId: string) => {
  for (const f of topic.value?.families ?? []) {
    const line = f.lines.find((l) => l.id === lineId)
    if (line) return line
  }
  return null
}

// Whether the current node's own line (= the base/prefix for all children) is mastered
const isBaseMastered = computed<boolean>(() => {
  const lineId = currentNode.value?.lineId
  if (!lineId) return true
  return progressApi.value?.isMastered(lineId) ?? false
})

const baseLine = computed(() => {
  const lineId = currentNode.value?.lineId
  if (!lineId) return null
  return findLine(lineId)
})

const baseLineName = computed<string>(() =>
  baseLine.value?.fullName ?? currentNode.value?.label ?? '',
)

// Action sheet for locked sub-variants (base not mastered)
interface LockedAction {
  label: string
  onProceed: () => void
}
const showLockedSheet = ref(false)
const lockedAction = ref<LockedAction | null>(null)

const tryLearnLine = (lineId: string, label: string) => {
  if (isBaseMastered.value) {
    learnLine(lineId)
    return
  }
  lockedAction.value = { label, onProceed: () => learnLine(lineId) }
  showLockedSheet.value = true
}

const tryLearnChildNode = (child: TreeNode) => {
  if (isBaseMastered.value) {
    learnChildNode(child)
    return
  }
  lockedAction.value = { label: child.label, onProceed: () => learnChildNode(child) }
  showLockedSheet.value = true
}

const confirmLearnBase = () => {
  showLockedSheet.value = false
  const lineId = currentNode.value?.lineId
  if (!lineId) return
  learnLine(lineId)
}

const confirmLearnAnyway = () => {
  showLockedSheet.value = false
  lockedAction.value?.onProceed()
}
</script>

<template>
  <div>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
    <!-- Breadcrumb -->
    <nav class="mb-4 flex flex-wrap items-center gap-1 text-sm text-(--ui-text-muted) sm:mb-6">
      <template v-for="(crumb, i) in breadcrumbs" :key="i">
        <span v-if="i > 0" class="select-none">/</span>
        <NuxtLink
          v-if="crumb.href"
          :to="crumb.href"
          class="hover:text-(--ui-text)"
        >
          {{ crumb.label }}
        </NuxtLink>
        <span v-else class="text-(--ui-text)">{{ crumb.label }}</span>
      </template>
    </nav>

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
    <UAlert
      v-else-if="!currentNode"
      color="warning"
      variant="soft"
      title="Knoten nicht gefunden"
    />

    <template v-else>
      <header class="mb-6 flex flex-col gap-3 sm:mb-8">
        <h1 class="text-2xl font-semibold sm:text-4xl">
          {{ currentNode.label }}
        </h1>
        <p class="text-sm text-(--ui-text-muted) sm:text-base">
          {{ nodeMasteredCount }} / {{ nodeLineIds.length }} Zugfolgen gemeistert
        </p>
        <div class="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
          <UButton
            color="primary"
            size="lg"
            icon="i-lucide-play"
            block
            class="sm:w-auto"
            :disabled="isNodeMastered"
            @click="learnNode"
          >
            {{ pathSegments.length === 0 ? 'Eröffnung üben' : 'Alle üben' }}
          </UButton>
          <p v-if="currentNode.lineId && !isBaseMastered" class="text-xs text-(--ui-text-muted) sm:ml-1">
            Startet mit der Grundvariante „{{ currentNode.label }}"
          </p>
        </div>
      </header>

      <!-- Current node has its own line — Grundposition card -->
      <div
        v-if="currentNode.lineId"
        class="relative mb-4 overflow-hidden rounded-xl border"
        :class="isBaseMastered
          ? 'border-(--ui-success)/40 bg-(--ui-success)/5'
          : 'border-(--ui-primary)/40 bg-(--ui-primary)/8'"
      >
        <!-- Left accent strip -->
        <div
          class="absolute inset-y-0 left-0 w-1"
          :class="isBaseMastered ? 'bg-(--ui-success)' : 'bg-(--ui-primary)'"
        />
        <div class="flex items-center justify-between gap-4 p-3 pl-5 sm:p-4 sm:pl-6">
          <div class="min-w-0">
            <p
              class="text-xs font-semibold uppercase tracking-widest"
              :class="isBaseMastered ? 'text-(--ui-success)' : 'text-(--ui-primary)'"
            >
              Grundposition
            </p>
            <p class="mt-0.5 truncate text-sm font-medium sm:text-base">
              {{ baseLine?.fullName ?? currentNode.label }}
            </p>
            <p v-if="baseLine" class="mt-0.5 text-xs text-(--ui-text-muted)">
              {{ baseLine.sanMoves.length }} Züge
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UBadge
              v-if="isBaseMastered"
              color="success"
              variant="soft"
              icon="i-lucide-check"
            >
              Gemeistert
            </UBadge>
            <UButton
              v-if="!isBaseMastered"
              size="sm"
              color="primary"
              icon="i-lucide-play"
              @click="learnLine(currentNode.lineId)"
            >
              Jetzt üben
            </UButton>
            <UButton
              v-else
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              @click="learnLine(currentNode.lineId)"
            >
              Wiederholen
            </UButton>
          </div>
        </div>
      </div>

      <!-- Info banner: base not yet mastered, sub-variants present -->
      <div
        v-if="currentNode.lineId && !isBaseMastered && currentNode.children.length > 0"
        class="mb-4 flex items-start gap-3 rounded-xl border border-(--ui-info)/30 bg-(--ui-info)/8 p-3 sm:p-4"
      >
        <UIcon name="i-lucide-info" class="mt-0.5 shrink-0 text-(--ui-info)" />
        <p class="text-sm text-(--ui-info)">
          Meistere erst die Grundposition <strong class="font-semibold">„{{ currentNode.label }}"</strong>,
          um Untervarianten von dieser Stellung zu starten.
        </p>
      </div>

      <!-- Children list (sub-nodes to navigate into) -->
      <ul
        v-if="currentNode.children.length > 0"
        class="divide-y divide-(--ui-border) overflow-hidden rounded-xl border border-(--ui-border) bg-(--ui-bg)"
      >
        <li
          v-for="child in currentNode.children"
          :key="child.label"
          class="group"
        >
          <!-- Leaf node: show line detail inline -->
          <template v-if="child.children.length === 0 && child.lineId">
            <div class="flex items-center justify-between gap-4 p-3 sm:p-4">
              <div class="min-w-0">
                <p class="truncate text-sm sm:text-base">
                  <span
                    v-if="findLine(child.lineId)?.eco"
                    class="mr-1 font-mono text-xs text-(--ui-text-muted)"
                  >
                    {{ findLine(child.lineId)!.eco }}
                  </span>
                  {{ child.label }}
                </p>
                <p
                  v-if="findLine(child.lineId)"
                  class="mt-0.5 text-xs text-(--ui-text-muted)"
                >
                  {{ findLine(child.lineId)!.sanMoves.length }} Züge
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <UBadge
                  v-if="progressApi?.isMastered(child.lineId)"
                  color="success"
                  variant="soft"
                  icon="i-lucide-check"
                >
                  Gemeistert
                </UBadge>
                <UButton
                  size="xs"
                  :color="isBaseMastered ? 'primary' : 'neutral'"
                  variant="soft"
                  :icon="isBaseMastered ? 'i-lucide-play' : 'i-lucide-lock'"
                  @click="tryLearnLine(child.lineId, child.label)"
                >
                  Üben
                </UButton>
              </div>
            </div>
          </template>

          <!-- Branch node: navigate deeper + optional Üben -->
          <template v-else>
            <div class="flex items-center justify-between gap-3 p-3 sm:p-4">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 text-left"
                @click="navigateInto(child.label)"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium sm:text-base">{{ child.label }}</p>
                  <p class="mt-0.5 text-xs text-(--ui-text-muted)">
                    {{ childProgressLabel(child) }} Zugfolgen
                  </p>
                </div>
              </button>
              <div class="flex shrink-0 items-center gap-2">
                <UBadge
                  v-if="isChildMastered(child)"
                  color="success"
                  variant="soft"
                  icon="i-lucide-check"
                >
                  Gemeistert
                </UBadge>
                <UButton
                  v-else
                  size="xs"
                  :color="isBaseMastered ? 'primary' : 'neutral'"
                  variant="soft"
                  :icon="isBaseMastered ? 'i-lucide-play' : 'i-lucide-lock'"
                  @click="tryLearnChildNode(child)"
                >
                  Üben
                </UButton>
                <button
                  type="button"
                  class="flex items-center p-1 text-(--ui-text-muted) hover:text-(--ui-text)"
                  @click="navigateInto(child.label)"
                >
                  <UIcon name="i-lucide-chevron-right" />
                </button>
              </div>
            </div>
          </template>
        </li>
      </ul>

      <!-- Leaf node with no children and no lineId (edge case) -->
      <p
        v-else-if="currentNode.children.length === 0 && !currentNode.lineId"
        class="text-sm text-(--ui-text-muted)"
      >
        Keine Zugfolgen gefunden.
      </p>
    </template>
  </div>

  <!-- Action sheet: base not mastered, user tried to start a sub-variant -->
  <UModal v-model:open="showLockedSheet">
    <template #content>
      <div class="p-4 sm:p-6">
        <div class="mb-5 flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ui-primary)/10">
            <UIcon name="i-lucide-lock" class="text-(--ui-primary)" />
          </div>
          <div>
            <h3 class="font-semibold">Grundvariante noch nicht gemeistert</h3>
            <p class="mt-1 text-sm text-(--ui-text-muted)">
              Um <strong class="text-(--ui-text)">„{{ lockedAction?.label }}"</strong>
              von der Grundposition zu starten, meistere erst
              <strong class="text-(--ui-text)">„{{ baseLineName }}"</strong>.
            </p>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <UButton
            color="primary"
            icon="i-lucide-play"
            block
            @click="confirmLearnBase"
          >
            „{{ baseLineName }}" jetzt üben
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            block
            @click="confirmLearnAnyway"
          >
            Trotzdem ohne Grundposition üben
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
  </div>
</template>
