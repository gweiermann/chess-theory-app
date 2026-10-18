<script setup lang="ts">
defineProps<{ error: { message?: string } }>()
</script>
<template>
  <main class="error-page">
    <p>CHESS THEORY</p>
    <h1>Das hat gerade nicht geklappt.</h1>
    <p>Dein Brett konnte nicht geladen werden. Versuche es bitte erneut.</p>
    <button @click="clearError({ redirect: '/' })">Erneut laden</button>
  </main>
</template>
<style scoped>
.error-page {
  max-width: 520px;
  margin: 15vh auto;
  padding: 24px;
  font-family: system-ui;
}
button {
  padding: 12px 20px;
  background: #2e614c;
  color: white;
  border: 0;
  border-radius: 8px;
}
</style>
