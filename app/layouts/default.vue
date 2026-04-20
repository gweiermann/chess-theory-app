<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

interface NavItem {
  to: string
  label: string
  icon: string
  match: (path: string) => boolean
}

const items: NavItem[] = [
  {
    to: '/learn',
    label: 'Lernen',
    icon: 'i-lucide-graduation-cap',
    match: (p) => p.startsWith('/learn'),
  },
  {
    to: '/activity',
    label: 'Aktivität',
    icon: 'i-lucide-history',
    match: (p) => p.startsWith('/activity'),
  },
  {
    to: '/openings',
    label: 'Eröffnungen',
    icon: 'i-lucide-book-open',
    match: (p) => p.startsWith('/openings'),
  },
]

const activePath = computed(() => route.path)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-(--ui-bg)">
    <main class="flex-1 pb-24">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t border-(--ui-border) bg-(--ui-bg)/95 backdrop-blur"
      aria-label="Hauptnavigation"
    >
      <ul
        class="mx-auto grid max-w-xl grid-cols-3"
        style="padding-bottom: env(safe-area-inset-bottom)"
      >
        <li v-for="item in items" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-xs font-medium transition-colors"
            :class="
              item.match(activePath)
                ? 'text-(--ui-primary)'
                : 'text-(--ui-text-muted) hover:text-(--ui-text)'
            "
          >
            <UIcon :name="item.icon" class="h-5 w-5" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
