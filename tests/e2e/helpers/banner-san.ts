/** Parse trailing SAN from banners that end with `: SAN` (locale-specific banner wording). */
export const parseSanFromBannerText = (text: string | null): string | null => {
  if (!text) return null
  const trimmed = text.trim()
  const m = trimmed.match(/:\s*([A-Za-z0-9+#=]+)\s*$/)
  return m?.[1] ?? null
}
