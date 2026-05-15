<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseDevPlayCommand } from './parseDevPlayCommand'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** Short label, e.g. who should play next (dev helper for agents). */
    nextMoveCaption?: string
    /** Expected SAN from the running line (same source as training feedback). */
    nextMoveSan?: string | null
  }>(),
  {
    nextMoveCaption: '',
    nextMoveSan: null,
  },
)

const emit = defineEmits<{
  command: [san: string]
}>()

const value = ref('')

const showHint = computed(
  () => Boolean(props.nextMoveCaption?.trim() || props.nextMoveSan),
)

const describedById = 'dev-play-next-move-hint'

const submit = (): void => {
  const san = parseDevPlayCommand(value.value)
  value.value = ''
  if (!san) return
  emit('command', san)
}

const onKeydown = (e: KeyboardEvent): void => {
  if (e.key !== 'Enter' || e.shiftKey) return
  e.preventDefault()
  submit()
}
</script>

<template>
  <div class="dev-play-command-host">
    <div class="dev-play-command-row">
      <div class="dev-play-command-input-col">
        <label class="dev-play-command-label" for="dev-play-command-input">
          Dev play command
        </label>
        <input
          id="dev-play-command-input"
          v-model="value"
          type="text"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          :disabled="disabled"
          :aria-describedby="showHint ? describedById : undefined"
          data-testid="dev-play-command-input"
          class="dev-play-command-input"
          @keydown="onKeydown"
        >
      </div>
      <div
        v-if="showHint"
        :id="describedById"
        class="dev-play-command-hint"
        data-testid="dev-play-next-move-hint"
        role="status"
      >
        <span v-if="nextMoveCaption?.trim()" class="dev-play-command-hint-caption">
          {{ nextMoveCaption }}
        </span>
        <code v-if="nextMoveSan" class="dev-play-command-hint-san" data-testid="dev-play-next-san">
          {{ nextMoveSan }}
        </code>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Dev-only: small bottom-left panel — input stays a real target for IDE browser
 * automation; hint shows the session’s expected SAN so agents need not grep JSON.
 */
.dev-play-command-host {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  left: env(safe-area-inset-left, 0);
  z-index: 30;
  pointer-events: auto;
  max-width: min(22rem, calc(100vw - 1rem));
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--ui-bg-elevated, #1a1a1a) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-border, #333) 80%, transparent);
  box-shadow: 0 4px 14px color-mix(in srgb, #000 35%, transparent);
}

.dev-play-command-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.dev-play-command-input-col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 0 0 auto;
}

.dev-play-command-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.dev-play-command-input {
  box-sizing: border-box;
  width: 6.5rem;
  min-height: 1.75rem;
  margin: 0;
  padding: 0.2rem 0.35rem;
  border: 1px solid color-mix(in srgb, var(--ui-border, #444) 85%, transparent);
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  font-family: ui-monospace, monospace;
  line-height: 1.3;
  color: var(--ui-text, #eee);
  background: color-mix(in srgb, var(--ui-bg, #111) 96%, transparent);
}

.dev-play-command-input:disabled {
  opacity: 0.55;
}

.dev-play-command-hint {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
  font-size: 0.75rem;
  line-height: 1.25;
  color: var(--ui-text-muted, #aaa);
}

.dev-play-command-hint-caption {
  font-weight: 500;
  color: var(--ui-text-muted, #bbb);
}

.dev-play-command-hint-san {
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ui-text, #f0f0f0);
  background: transparent;
}
</style>
