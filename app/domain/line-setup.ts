import { findParentLine, type SelectionFocus } from './select-next-line'
import type { Line, LineProgress, Topic } from './types'

export interface LineSetup {
  prefixPlies: number
  skipIntro: boolean
}

/**
 * Compute the prefix-ply length and skip-intro flag for a freshly-started
 * drill on `line`. Honours the user's selection (`focus`) — when training a
 * tree node, the node's own line is forced as a prefix iff already mastered;
 * exclusive line selections always skip the intro. Otherwise the standard
 * parent-line discovery applies, gated by the autoPlay-prefix profile flag.
 */
export const computeLineSetup = ({
  topic,
  line,
  progress,
  focus,
  autoPlayParentPrefix,
}: {
  topic: Topic
  line: Line
  progress: ReadonlyArray<LineProgress>
  focus: SelectionFocus | undefined
  autoPlayParentPrefix: boolean
}): LineSetup => {
  const masteredSet = new Set(
    progress.filter((p) => p.status === 'mastered').map((p) => p.lineId),
  )

  let forcedParent: Line | null = null
  if (focus?.kind === 'node' && focus.prefixLineId && focus.prefixLineId !== line.id) {
    const candidate = topic.families
      .flatMap((f) => f.lines)
      .find((l) => l.id === focus.prefixLineId) ?? null
    if (
      candidate
      && masteredSet.has(candidate.id)
      && candidate.sanMoves.length > 0
      && candidate.sanMoves.length < line.sanMoves.length
      && candidate.sanMoves.every((san, i) => san === line.sanMoves[i])
      // At least one user move must remain after the prefix (otherwise the
      // session would start in 'done' state — e.g. a 6-move line whose only
      // extra move beyond the 5-move base is the opponent's response)
      && line.sanMoves.slice(candidate.sanMoves.length).some((_, i) => {
        const idx = candidate.sanMoves.length + i
        return (idx % 2 === 0) === (line.userSide === 'white')
      })
    ) {
      forcedParent = candidate
    }
  }

  const rawParent = forcedParent ?? findParentLine(topic, line, [...progress])
  // Discard a parent that leaves no user moves after the prefix — the session
  // would complete instantly (e.g. Hungarian Defense base after Italian Game:
  // only Be7 remains, which is the opponent's move, giving the user nothing to do).
  const hasUserMoveAfterPrefix = (p: Line): boolean =>
    line.sanMoves.slice(p.sanMoves.length).some((_, i) => {
      const idx = p.sanMoves.length + i
      return (idx % 2 === 0) === (line.userSide === 'white')
    })
  const parent = rawParent && hasUserMoveAfterPrefix(rawParent) ? rawParent : null
  const hasRealParent =
    !!parent
    && parent.sanMoves.length > 0
    && parent.sanMoves.length < line.sanMoves.length

  const userExplicitSelection =
    !!forcedParent
    || (focus?.kind === 'node' && !!focus.prefixLineId)
    || (focus?.kind === 'line' && focus.exclusive === true)

  const prefixPlies = hasRealParent ? parent!.sanMoves.length : 0
  const introIsPlayable = hasRealParent
  const runsIntro =
    introIsPlayable
    && prefixPlies > 0
    && !autoPlayParentPrefix
    && !userExplicitSelection

  return { prefixPlies, skipIntro: !runsIntro }
}
