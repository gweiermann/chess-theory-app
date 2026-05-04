<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BasePageHeader from '~/components/base/BasePageHeader.vue'
import ActivityList from '~/components/activity/ActivityList.vue'
import { useRecentActivity, type ResolvedActivityEntry } from '~/composables/useRecentActivity'
import { useCurrentSelection } from '~/composables/useCurrentSelection'

const router = useRouter()
const { entries, loading, refresh } = useRecentActivity()
const { set: setSelection } = useCurrentSelection()

onMounted(() => refresh(50))

const resume = (entry: ResolvedActivityEntry): void => {
  if (!entry.line) return
  setSelection({
    topicId: entry.topicId,
    focus: { kind: 'line', lineId: entry.line.id },
  })
  router.push('/learn')
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
    <BasePageHeader
      eyebrow="Profil · Aktivität"
      title="Zuletzt geübt"
      description="Wechsle schnell zwischen den Zugfolgen, an denen du zuletzt gearbeitet hast."
    />
    <ActivityList :entries="entries" :loading="loading" @resume="resume" />
  </div>
</template>
