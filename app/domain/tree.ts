import { normalizeFamilyName, splitFamilyAndPath } from './line'
import type { Line, TreeNode } from './types'

const findOrCreateChild = (parent: TreeNode, label: string): TreeNode => {
  const existing = parent.children.find((c) => c.label === label)
  if (existing) return existing
  const next: TreeNode = { label, children: [] }
  parent.children.push(next)
  return next
}

interface ExpandedParts {
  canonicalFamily: string
  path: string[]
}

/**
 * Split a line's full name into the canonical family (after merging
 * Accepted/Declined siblings) plus the variation path that sits below it.
 * The stripped "Accepted"/"Declined" token is re-attached as the first
 * segment of the path so the tree still shows the user which branch the
 * line belongs to, e.g. Center Game → Accepted → Variation. Without this
 * prefix, "Center Game Accepted" and "Center Game Accepted: Foo" would
 * both collapse onto a single "Center Game" node and their line-ids would
 * fight for the same slot.
 */
const expand = (line: Line): ExpandedParts => {
  const { family, path } = splitFamilyAndPath(line.fullName)
  const canonical = normalizeFamilyName(family)
  if (canonical === family) {
    return { canonicalFamily: canonical, path }
  }
  const branch = family.slice(canonical.length).trim()
  return {
    canonicalFamily: canonical,
    path: branch ? [branch, ...path] : path,
  }
}

export const buildFamilyTree = (lines: readonly Line[]): TreeNode => {
  if (lines.length === 0) {
    throw new Error('buildFamilyTree requires at least one line')
  }

  const parsed = lines.map((line) => ({
    line,
    parts: expand(line),
  }))

  const familyName = parsed[0]!.parts.canonicalFamily
  for (const { parts } of parsed) {
    if (parts.canonicalFamily !== familyName) {
      throw new Error(
        `buildFamilyTree expects a single family but got "${familyName}" and "${parts.canonicalFamily}"`,
      )
    }
  }

  const root: TreeNode = { label: familyName, children: [] }

  for (const { line, parts } of parsed) {
    if (parts.path.length === 0) {
      root.lineId = line.id
      continue
    }

    let cursor = root
    for (let i = 0; i < parts.path.length; i += 1) {
      const segment = parts.path[i]!
      cursor = findOrCreateChild(cursor, segment)
      if (i === parts.path.length - 1) {
        cursor.lineId = line.id
      }
    }
  }

  return root
}

export const flattenLineIdsInOrder = (node: TreeNode): string[] => {
  const out: string[] = []
  const visit = (n: TreeNode) => {
    if (n.lineId) out.push(n.lineId)
    for (const child of n.children) visit(child)
  }
  visit(node)
  return out
}
