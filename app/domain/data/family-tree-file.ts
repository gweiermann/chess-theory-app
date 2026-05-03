import type { Family, FamilyCategory, Line, TreeNode } from '../types'

/**
 * On-disk shape for `.../families/<id>.json`: one nested tree. Each node has
 * a display `label`, optional full `line` payload at that node, and nested
 * `children` — no separate top-level `lines` or `tree` keys.
 */
export interface FamilyTreeWireNode {
  label: string
  line?: Line
  children: FamilyTreeWireNode[]
}

export interface FamilyTreeWireFile {
  id: string
  name: string
  category: FamilyCategory
  label: string
  line?: Line
  children: FamilyTreeWireNode[]
}

const nodeToWire = (node: TreeNode, byId: Map<string, Line>): FamilyTreeWireNode => {
  const line = node.lineId ? byId.get(node.lineId) : undefined
  if (node.lineId && !line) {
    throw new Error(`Missing line for id "${node.lineId}" under "${node.label}"`)
  }
  return {
    label: node.label,
    ...(line ? { line } : {}),
    children: node.children.map((c) => nodeToWire(c, byId)),
  }
}

export const familyToTreeFile = (family: Family): FamilyTreeWireFile => {
  const byId = new Map(family.lines.map((l) => [l.id, l]))
  const root = family.tree
  const line = root.lineId ? byId.get(root.lineId) : undefined
  if (root.lineId && !line) {
    throw new Error(`Missing line for root id "${root.lineId}"`)
  }
  return {
    id: family.id,
    name: family.name,
    category: family.category,
    label: root.label,
    ...(line ? { line } : {}),
    children: root.children.map((c) => nodeToWire(c, byId)),
  }
}

const wireNodeToTreeNode = (node: FamilyTreeWireNode): TreeNode => ({
  label: node.label,
  lineId: node.line?.id,
  children: node.children.map(wireNodeToTreeNode),
})

const collectLinesPreorder = (file: FamilyTreeWireFile): Line[] => {
  const out: Line[] = []
  const visit = (node: { line?: Line; children: FamilyTreeWireNode[] }) => {
    if (node.line) out.push(node.line)
    for (const c of node.children) visit(c)
  }
  visit(file)
  return out
}

export const treeFileToFamily = (raw: unknown): Family => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Family file must be a JSON object')
  }
  const file = raw as Partial<FamilyTreeWireFile>
  if (
    typeof file.id !== 'string'
    || typeof file.name !== 'string'
    || typeof file.category !== 'string'
    || typeof file.label !== 'string'
    || !Array.isArray(file.children)
  ) {
    throw new Error('Invalid family tree file: missing id, name, category, label, or children')
  }
  const children = file.children as FamilyTreeWireNode[]
  for (const c of children) {
    if (!c || typeof c !== 'object' || typeof c.label !== 'string' || !Array.isArray(c.children)) {
      throw new Error('Invalid family tree file: malformed child node')
    }
  }
  const full: FamilyTreeWireFile = {
    id: file.id,
    name: file.name,
    category: file.category as FamilyCategory,
    label: file.label,
    ...(file.line ? { line: file.line } : {}),
    children,
  }
  const tree: TreeNode = {
    label: full.label,
    lineId: full.line?.id,
    children: full.children.map(wireNodeToTreeNode),
  }
  return {
    id: full.id,
    name: full.name,
    category: full.category,
    lines: collectLinesPreorder(full),
    tree,
  }
}
