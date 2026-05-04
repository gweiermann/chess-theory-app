<script setup lang="ts">
interface Props {
  baseLabel: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="mb-4 flex items-start gap-3 rounded-xl border border-(--ui-info)/30 bg-(--ui-info)/8 p-3 sm:p-4"
    role="note"
  >
    <UIcon name="i-lucide-info" class="mt-0.5 shrink-0 text-(--ui-info)" />
    <p class="text-sm text-(--ui-info)">
      Meistere erst die Grundposition
      <strong class="font-semibold">„{{ baseLabel }}“</strong>,
      um Untervarianten von dieser Stellung zu starten.
    </p>
  </div>
</template>
