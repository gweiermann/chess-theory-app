/**
 * Single-line dev bridge input: trimmed SAN, or null for empty / comment.
 */
export const parseDevPlayCommand = (raw: string): string | null => {
  const line = raw.trim()
  if (!line || line.startsWith('#')) return null
  return line
}
