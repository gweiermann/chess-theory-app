import { splitFamilyAndPath } from './line'
import type { Line, TreeNode } from './types'

const findOrCreateChild = (parent: TreeNode, label: string): TreeNode => {
  const existing = parent.children.find((c) => c.label === label)
  if (existing) return existing
  const next: TreeNode = { label, children: [] }
  parent.children.push(next)
  return next
}

export const buildFamilyTree = (lines: readonly Line[]): TreeNode => {
  if (lines.length === 0) {
    throw new Error('buildFamilyTree requires at least one line')
  }

  const parsed = lines.map((line) => ({
    line,
    parts: splitFamilyAndPath(line.fullName),
  }))

  const familyName = parsed[0]!.parts.family
  for (const { parts } of parsed) {
    if (parts.family !== familyName) {
      throw new Error(
        `buildFamilyTree expects a single family but got "${familyName}" and "${parts.family}"`,
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
