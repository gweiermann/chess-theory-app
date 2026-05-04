<script setup lang="ts">
interface Props {
  title?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Alles gemeistert',
  description: 'Du hast alle Zugfolgen dieser Auswahl durchgespielt. Wähle eine neue in den Eröffnungen oder in deinem Profil.',
})
</script>

<template>
  <div class="m-4">
    <UAlert
      color="success"
      variant="soft"
      icon="i-lucide-trophy"
      :title="title"
      :description="description"
    />
  </div>
</template>
