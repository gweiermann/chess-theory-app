/** Mirrors `app/pages/learn/play.vue` timing (PRD §4.4.1). */
export const OPPONENT_DELAY_MS = 350
export const STEP_RESET_DELAY_MS = 600
export const NEXT_LINE_DELAY_MS = 1500
export const MISTAKE_BANNER_MS = 1800
export const PREFIX_REPLAY_DELAY_MS = 120
export const ANIM_BUFFER_MS = 200

/** Cap for Playwright expects, locator waits, and clicks in e2e (fast iteration). */
export const E2E_MAX_WAIT_MS = 2000

/** Client-side Nuxt navigations: avoid waiting for full document `load` on SPA route changes. */
export const SPA_WAIT_UNTIL = 'commit' as const
