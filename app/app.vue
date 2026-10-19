<script setup lang="ts">
const base = useRuntimeConfig().app.baseURL
useHead({
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: `${base}icons/app.svg` },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: `${base}icons/apple-touch-icon.png`,
    },
  ],
})
</script>
<template>
  <VitePwaManifest />
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
