<script setup lang="ts">
export interface Crumb {
  label: string
  href: string | null
}

interface Props {
  crumbs: ReadonlyArray<Crumb>
}

defineProps<Props>()
</script>

<template>
  <nav
    aria-label="Breadcrumb"
    class="mb-4 flex flex-wrap items-center gap-1 py-1 text-xl text-(--ui-text-muted) sm:mb-6"
  >
    <template v-for="(crumb, i) in crumbs" :key="`${i}-${crumb.label}`">
      <span v-if="i > 0" aria-hidden="true" class="select-none">/</span>
      <NuxtLink
        v-if="crumb.href"
        :to="crumb.href"
        class="hover:text-(--ui-text)"
      >
        {{ crumb.label }}
      </NuxtLink>
      <span v-else class="text-(--ui-text)" aria-current="page">{{ crumb.label }}</span>
    </template>
  </nav>
</template>
