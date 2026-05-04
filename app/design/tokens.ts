export const radius = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  pill: 'rounded-full',
} as const

export const surface = {
  card: 'rounded-xl border border-(--ui-border) bg-(--ui-bg)',
  panel: 'rounded-xl bg-(--ui-bg-elevated)',
  outline: 'rounded-xl border border-(--ui-border)',
} as const

export const padding = {
  compact: 'p-3 sm:p-4',
  comfortable: 'p-4 sm:p-5',
  spacious: 'p-6',
} as const

export const heading = {
  page: 'text-2xl font-semibold sm:text-4xl',
  section: 'text-lg font-semibold sm:text-xl',
  card: 'text-base font-semibold',
  eyebrow: 'text-xs uppercase tracking-widest text-(--ui-text-muted)',
} as const

export const body = {
  base: 'text-sm sm:text-base text-(--ui-text)',
  muted: 'text-sm text-(--ui-text-muted)',
  small: 'text-xs text-(--ui-text-muted)',
} as const

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ui-primary) focus-visible:ring-offset-2 focus-visible:ring-offset-(--ui-bg)'

export const headerBlock = 'mb-6 flex flex-col gap-2 sm:mb-8'

export type RadiusToken = keyof typeof radius
export type SurfaceToken = keyof typeof surface
export type PaddingToken = keyof typeof padding
export type HeadingToken = keyof typeof heading
export type BodyToken = keyof typeof body
