import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'chess-theory:v1:profile-settings'

interface StoredProfileSettings {
  autoPlayParentPrefix?: boolean
}

interface ProfileSettingsState {
  autoPlayParentPrefix: Ref<boolean>
}

let cached: ProfileSettingsState | null = null
let hydrated = false

const hydrate = (state: ProfileSettingsState): void => {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as StoredProfileSettings
    if (typeof parsed.autoPlayParentPrefix === 'boolean') {
      state.autoPlayParentPrefix.value = parsed.autoPlayParentPrefix
    }
  } catch {
    // Keep defaults when storage is unavailable or malformed.
  }
}

export const useProfileSettings = (): ProfileSettingsState => {
  if (!cached) {
    cached = {
      // Default OFF: no auto-replay of parent-prefix moves.
      autoPlayParentPrefix: ref(false),
    }

    watch(cached.autoPlayParentPrefix, (value) => {
      if (typeof window === 'undefined') return
      const payload: StoredProfileSettings = { autoPlayParentPrefix: value }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    })
  }

  hydrate(cached)
  return cached
}
