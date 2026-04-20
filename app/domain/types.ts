export type Side = 'white' | 'black'

export interface Line {
  id: string
  eco: string
  fullName: string
  pgn: string
  sanMoves: string[]
  userSide: Side
}

export interface TreeNode {
  label: string
  lineId?: string
  children: TreeNode[]
}

export interface Family {
  id: string
  name: string
  lines: Line[]
  tree: TreeNode
}

export interface Topic {
  id: string
  firstMove: string
  label: string
  families: Family[]
}

export interface OpeningsDataset {
  generatedAt: string
  topics: Topic[]
}

export type ProgressStatus = 'new' | 'in-progress' | 'mastered'

export interface LineProgress {
  lineId: string
  status: ProgressStatus
  reps: number
  lastPracticedAt?: number
}
