<script setup lang="ts">
defineProps<{ active: 'learn' | 'library' | 'profile' }>()
</script>
<template>
  <div class="app-frame">
    <header class="app-header">
      <NuxtLink to="/" class="brand"
        ><span class="brand-icon" aria-hidden="true"
          ><svg viewBox="0 0 24 24">
            <path
              d="M5 4h3v3h2V4h4v3h2V4h3v6l-3 2 1 7H7l1-7-3-2V4ZM5 21h14"
            /></svg></span
        ><span>Chess Theory</span></NuxtLink
      >
    </header>
    <main class="page"><slot /></main>
    <nav class="navigation" aria-label="Hauptnavigation">
      <NuxtLink to="/" :aria-current="active === 'learn' ? 'page' : undefined"
        ><svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 9 9-5 9 5-9 5-9-5Zm4 3v5c3 3 7 3 10 0v-5M21 9v7" /></svg
        >Lernen</NuxtLink
      >
      <NuxtLink
        to="/openings"
        :aria-current="active === 'library' ? 'page' : undefined"
        ><svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 6v14M3 5c4-1 6-1 9 1 3-2 5-2 9-1v14c-4-1-6-1-9 1-3-2-5-2-9-1V5Z"
          /></svg
        >Bibliothek</NuxtLink
      >
      <NuxtLink
        to="/profile"
        :aria-current="active === 'profile' ? 'page' : undefined"
        ><svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg
        >Profil</NuxtLink
      >
    </nav>
  </div>
</template>
<style scoped>
.app-frame {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-header {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  border-bottom: 0;
  flex-shrink: 0;
}
.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  text-decoration: none;
  font-weight: 700;
  letter-spacing: -0.025em;
  font-size: 18px;
}
.brand-icon {
  font-size: 25px;
  background: var(--green);
  color: #fff;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  box-shadow: 0 2px 0 #254d37;
}
.brand-icon svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.page {
  width: 100%;
  max-width: 1060px;
  flex: 1;
  min-height: 0;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.navigation {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  gap: 16px;
  padding: 8px 16px max(8px, env(safe-area-inset-bottom));
  background: var(--paper);
  border-top: 1px solid var(--line);
}
.navigation a {
  display: grid;
  gap: 2px;
  text-align: center;
  min-width: 72px;
  min-height: 40px;
  text-decoration: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  padding: 4px 16px;
  border-radius: 14px;
  align-items: center;
  justify-items: center;
  min-width: 100px;
}
.navigation svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.navigation a[aria-current] {
  color: var(--green);
  background: var(--soft-green);
}
@media (max-width: 600px) {
  .app-header {
    padding: 7px 14px;
  }
  .brand-icon {
    width: 30px;
    height: 30px;
    font-size: 23px;
  }
  .brand {
    font-size: 15px;
  }
  .page {
    padding: 14px;
    gap: 10px;
  }
  .navigation {
    gap: 8px;
    padding: 6px 12px max(6px, env(safe-area-inset-bottom));
  }
  .navigation a {
    flex: 1;
    max-width: 120px;
    min-width: 0;
    padding: 4px 8px;
  }
}
@media (max-height: 680px) and (max-width: 600px) {
  .page {
    padding: 10px 12px;
    gap: 8px;
  }
}
</style>
