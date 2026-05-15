import { describe, expect, it } from 'vitest'
import { parseDevPlayCommand } from '~/components/play/parseDevPlayCommand'

describe('parseDevPlayCommand', () => {
  it('returns null for empty and comment lines', () => {
    expect(parseDevPlayCommand('')).toBeNull()
    expect(parseDevPlayCommand('   ')).toBeNull()
    expect(parseDevPlayCommand('# e4')).toBeNull()
  })

  it('returns trimmed SAN', () => {
    expect(parseDevPlayCommand('  e4  ')).toBe('e4')
    expect(parseDevPlayCommand('Nf3')).toBe('Nf3')
  })
})
