import { createRepertoire, terminalLines } from '../openings'
import { chooseReply, recommendMove } from '../selection'
import { isSavedSession } from '../learning'
import { progressKey } from '../shared'
import type { LearningOutcome, MoveInput, SavedSession } from '../shared'
import type { BoardCheckpoint } from '../board/public'
import type {
  TrainingController,
  TrainingOptions,
  TrainingSnapshot,
  Phase,
} from './public'
import { DEFAULT_TIMING, evaluateMove } from './policy'
import type { LearnerRepository, SaveResult } from '../learning'

const identifier = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
const sessionWriters = new WeakMap<LearnerRepository, number>()
const sessionWrites = new WeakMap<LearnerRepository, Promise<void>>()

/** Coordinates accepted positions, teaching decisions and effects. No rendering or storage-format knowledge. */
export function createTraining(options: TrainingOptions): TrainingController {
  const { board, repository, family, settings } = options
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const progress = options.learning?.progress ?? {}
  const memories = options.learning?.memories ?? {}
  const fullLines = terminalLines(family.lines).sort(
    (a, b) => b.moves.length - a.moves.length || a.id.localeCompare(b.id),
  )
  const listeners = new Set<() => void>()
  const pendingOutcomes = new Map<string, LearningOutcome>()
  let persistence = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let writer = 0
  let disposed = false
  let checkpoint: BoardCheckpoint
  let setupPlies = 0
  let attempt = 0
  let helped = false
  let suggested: string | null = null
  let repetitionMistakes = 0
  let repetitionAssisted = false
  let roundFinished = false
  let pendingReset = false
  let state: TrainingSnapshot = {
    status: 'player',
    phase: 'guided',
    mode: 'guided',
    side: settings.side,
    line: family.lines[0]!,
    expectedSan: null,
    available: [],
    cleanRepetitions: 0,
    targetRepetitions: settings.repetitions,
    round: 1,
    mistakes: 0,
    recalled: 0,
    assisted: 0,
    message: 'ready',
    newMaterial: false,
    persistenceError: null,
  }
  const notify = () => {
    if (!disposed) for (const listener of listeners) listener()
  }
  const cancel = () => {
    generation++
    clearTimeout(timer)
    timer = undefined
  }
  const learned = () =>
    family.lines.filter(
      (line) =>
        progress[progressKey(line.id, state.side)]?.status === 'mastered',
    )
  const repertoireLines = () =>
    state.mode === 'sparring' ? fullLines : [state.line]
  const repertoire = () => createRepertoire(repertoireLines())
  const saveError = (message: string) => {
    state.persistenceError = message
    notify()
  }
  const savedSession = (): SavedSession | null =>
    state.phase === 'complete'
      ? null
      : {
          version: 1,
          pendingReset,
          phase: state.phase as Exclude<Phase, 'complete'>,
          datasetRevision: options.datasetRevision,
          lineId: state.line.id,
          familyId: family.summary.id,
          side: state.side,
          mode: state.mode,
          moves: [...board.snapshot().moves],
          setupPlies,
          repetitions: state.targetRepetitions,
          cleanRepetitions: state.cleanRepetitions,
          mistakes: state.mistakes,
          assisted: state.assisted,
          recalled: state.recalled,
          round: state.round,
          attempt,
          helped,
          suggested,
          allowNew: settings.allowNew,
          repetitionMistakes,
          repetitionAssisted,
        }
  const saveCurrentSession = (
    saved: SavedSession | null,
    owner: number,
  ): Promise<SaveResult | undefined> => {
    // A write already inside an asynchronous adapter cannot be cancelled. Queue subsequent
    // controllers behind it so their latest session always becomes the final durable value.
    const operation = (sessionWrites.get(repository) ?? Promise.resolve()).then(
      () => {
        if (sessionWriters.get(repository) !== owner) return undefined
        return repository.saveSession(saved)
      },
    )
    sessionWrites.set(
      repository,
      operation.then(
        () => {},
        () => {},
      ),
    )
    return operation
  }
  const persistSession = () => {
    const saved = savedSession()
    const owner = writer
    persistence = persistence
      .then(async () => {
        if (sessionWriters.get(repository) !== owner) return
        const result = await saveCurrentSession(saved, owner)
        if (result?.status === 'failed') saveError(result.message)
      })
      .catch((error) => saveError(String(error)))
  }
  const record = (outcome: LearningOutcome) => {
    pendingOutcomes.set(outcome.id, outcome)
    persistence = persistence
      .then(async () => {
        const result = await repository.record(outcome)
        if (result.status === 'failed') saveError(result.message)
        else pendingOutcomes.delete(outcome.id)
      })
      .catch((error) => saveError(String(error)))
  }
  const outcome = (
    move: string,
    positionKey: string,
    grade: LearningOutcome['grade'],
    completed = false,
    kind: 'response' | 'round' = 'response',
  ): LearningOutcome => ({
    kind,
    requiredRepetitions: state.targetRepetitions,
    id: identifier(),
    at: now(),
    lineId: state.line.id,
    familyId: family.summary.id,
    side: state.side,
    mode: state.mode,
    positionKey,
    move,
    grade,
    mistakes:
      kind === 'round' ? repetitionMistakes : grade === 'new' ? 0 : attempt,
    completed,
    cleanRepetitions: state.cleanRepetitions,
    datasetRevision: options.datasetRevision,
  })
  const arrow = (
    san: string | null,
    purpose: 'solution' | 'exploration' | 'demonstration',
  ) => {
    const move = board.snapshot().legalMoves.find((move) => move.san === san)
    board.showArrows(move ? [{ from: move.from, to: move.to, purpose }] : [])
  }
  const updateChoices = () => {
    const position = board.snapshot()
    const choices = repertoire().continuations(position.moves)
    if (state.mode === 'sparring') {
      const longest = repertoire().matching(position.moves)[0]
      if (longest) state.line = longest
    }
    state.available = choices
    state.expectedSan = choices[0] ?? null
    state.newMaterial =
      state.phase === 'sparring' &&
      !learned().some(
        (line) =>
          line.moves.length > position.moves.length &&
          position.moves.every((move, index) => line.moves[index] === move),
      )
  }
  const schedule = (callback: () => void, delay: number) => {
    const epoch = generation
    const revision = board.snapshot().revision
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      if (
        !disposed &&
        epoch === generation &&
        revision === board.snapshot().revision &&
        board.snapshot().viewedPly === null
      )
        callback()
    }, delay)
  }
  const finishRound = () => {
    if (roundFinished) return
    roundFinished = true
    const wasGuided = state.phase === 'guided'
    if (!wasGuided && !repetitionMistakes && !repetitionAssisted)
      state.cleanRepetitions++
    const complete =
      state.mode === 'sparring' ||
      (!wasGuided && state.cleanRepetitions >= state.targetRepetitions)
    record(
      outcome(
        board.snapshot().moves.at(-1) ?? '-',
        board.snapshot().positionKey,
        repetitionAssisted
          ? 'hinted'
          : repetitionMistakes
            ? 'retried'
            : wasGuided
              ? 'new'
              : 'recalled',
        complete,
        'round',
      ),
    )
    board.configureInput({ input: 'disabled' })
    if (complete) {
      state.phase = 'complete'
      state.status = 'complete'
      state.message = 'complete'
      state.available = []
      state.expectedSan = null
      persistSession()
      notify()
      return
    }
    state.status = 'opponent'
    state.message = wasGuided ? 'recall' : 'repeat'
    state.phase = 'recall'
    pendingReset = true
    persistSession()
    notify()
    scheduleReset()
  }
  const scheduleReset = () =>
    schedule(() => {
      if (board.resetToCheckpoint(checkpoint).status !== 'accepted') {
        state.status = 'error'
        notify()
        return
      }
      attempt = 0
      helped = false
      suggested = null
      repetitionMistakes = 0
      repetitionAssisted = false
      roundFinished = false
      pendingReset = false
      state.round++
      advance()
    }, options.resetDelayMs ?? DEFAULT_TIMING.resetMs)
  const advance = () => {
    if (disposed) return
    if (pendingReset) {
      scheduleReset()
      return
    }
    updateChoices()
    if (!state.available.length) {
      finishRound()
      return
    }
    const position = board.snapshot()
    if (position.turn !== state.side) {
      state.status = 'opponent'
      board.configureInput({
        input: settings.premoves ? 'premove' : 'disabled',
        premoves: settings.premoves,
      })
      notify()
      schedule(() => {
        const reply =
          state.mode === 'sparring'
            ? chooseReply({
                lines: family.lines,
                history: board.snapshot().moves,
                side: state.side,
                mode: state.mode,
                progress,
                memories,
                now: now(),
                random,
                allowNew: settings.allowNew,
              })?.san
            : state.expectedSan
        if (
          !reply ||
          board.makeMove(reply, position.revision).status !== 'accepted'
        ) {
          state.status = 'error'
          board.configureInput({ input: 'disabled' })
          notify()
          return
        }
        persistSession()
        const hadPremove = board.snapshot().premove !== null
        advance()
        const premove = board.takePremove()
        if (premove && state.status === 'player') submitMove(premove, true)
        else if (hadPremove && state.status === 'player') {
          state.message = 'premove-cancelled'
          notify()
        }
      }, options.opponentDelayMs ?? DEFAULT_TIMING.opponentMs)
    } else {
      state.status = 'player'
      board.configureInput({
        input: settings.premoves ? 'premove' : 'player',
        premoves: settings.premoves,
      })
      if (state.phase === 'guided') arrow(state.expectedSan, 'demonstration')
      else if (settings.suggestions === 'automatic')
        controller.requestSuggestion()
      if (state.newMaterial) state.message = 'new'
      persistSession()
      notify()
    }
  }
  const submitMove = (move: MoveInput, preservePremoves = false) => {
    if (disposed || state.phase === 'complete' || state.status === 'error')
      return
    const result = board.proposeMove(move)
    if (result.status === 'queued') {
      state.message = 'premove'
      notify()
      return
    }
    if (result.status === 'illegal') {
      state.message = 'illegal'
      notify()
      return
    }
    if (result.status !== 'proposed') return
    const decision = evaluateMove({
      san: result.attempt.san,
      permitted: state.available,
      phase: state.phase,
      attempt,
      helped,
      suggested,
      newMaterial:
        state.mode === 'sparring'
          ? !learned().some(
              (line) =>
                board
                  .snapshot()
                  .moves.every((san, index) => line.moves[index] === san) &&
                line.moves[board.snapshot().moves.length] ===
                  result.attempt.san,
            )
          : state.newMaterial,
    })
    if (!decision.accepted) {
      board.rejectMove(result.attempt.id)
      attempt++
      if (!state.newMaterial) {
        repetitionMistakes++
        state.mistakes++
      }
      state.message = attempt === 1 ? 'retry' : 'outside'
      if (decision.reveal) controller.requestHelp()
      persistSession()
      notify()
      return
    }
    if (
      board.acceptMove(result.attempt.id, { preservePremoves }).status !==
      'accepted'
    )
      return
    const matched = repertoire().matching(board.snapshot().moves)
    if (
      state.mode === 'sparring' &&
      !matched.some((line) => line.id === state.line.id) &&
      matched[0]
    )
      state.line = matched[0]
    if (decision.grade === 'recalled') state.recalled++
    else {
      state.assisted++
      repetitionAssisted = true
    }
    record(
      outcome(result.attempt.san, result.attempt.positionKey, decision.grade),
    )
    attempt = 0
    helped = false
    suggested = null
    state.message = 'correct'
    advance()
  }
  const controller: TrainingController = {
    snapshot: () => ({ ...state, available: [...state.available] }),
    start(lineId, mode, side, saved) {
      if (disposed) return
      cancel()
      writer = (sessionWriters.get(repository) ?? 0) + 1
      sessionWriters.set(repository, writer)
      const requested = family.lines.find((line) => line.id === lineId)
      const line =
        requested && mode === 'guided'
          ? (fullLines.find((candidate) =>
              requested.moves.every(
                (move, index) => candidate.moves[index] === move,
              ),
            ) ?? requested)
          : requested
      if (!line) {
        state.status = 'error'
        notify()
        return
      }
      state = {
        ...state,
        line,
        mode,
        side,
        phase:
          mode === 'guided'
            ? 'guided'
            : mode === 'review'
              ? 'recall'
              : 'sparring',
        status: 'player',
        cleanRepetitions: 0,
        targetRepetitions: mode === 'guided' ? settings.repetitions : 1,
        round: 1,
        mistakes: 0,
        recalled: 0,
        assisted: 0,
        message: 'ready',
        newMaterial: false,
      }
      attempt = 0
      helped = false
      suggested = null
      repetitionMistakes = 0
      repetitionAssisted = false
      roundFinished = false
      pendingReset = false
      setupPlies = 0
      if (settings.autoSetup && mode !== 'sparring') {
        const parents = family.lines.filter(
          (parent) =>
            progress[progressKey(parent.id, side)]?.status === 'mastered' &&
            parent.moves.length < line.moves.length &&
            parent.moves.every((move, index) => line.moves[index] === move) &&
            line.moves
              .slice(parent.moves.length)
              .some(
                (_, index) =>
                  ((index + parent.moves.length) % 2 === 0) ===
                  (side === 'white'),
              ),
        )
        setupPlies = Math.max(
          0,
          ...parents.map((parent) => parent.moves.length),
        )
      }
      if (mode === 'sparring' && settings.autoSetup) {
        const candidates = repertoireLines()
        while (
          setupPlies < 6 &&
          candidates.length &&
          candidates.every(
            (candidate) =>
              candidate.moves[setupPlies] &&
              candidate.moves[setupPlies] === candidates[0]!.moves[setupPlies],
          )
        )
          setupPlies++
        if (
          !candidates.some((candidate) =>
            candidate.moves
              .slice(setupPlies)
              .some(
                (_, index) =>
                  ((index + setupPlies) % 2 === 0) === (side === 'white'),
              ),
          )
        )
          setupPlies = 0
      }
      board.load({ moves: line.moves.slice(0, setupPlies) })
      board.configureInput({
        orientation: side,
        playerSide: side,
        input: 'disabled',
      })
      checkpoint = board.saveCheckpoint()
      if (saved) {
        const valid =
          isSavedSession(saved) &&
          saved.datasetRevision === options.datasetRevision &&
          saved.familyId === family.summary.id &&
          saved.side === side &&
          saved.mode === mode &&
          saved.lineId === line.id &&
          createRepertoire(
            mode === 'sparring' ? repertoireLines() : [line],
          ).matching(saved.moves).length > 0 &&
          saved.moves
            .slice(0, saved.setupPlies)
            .every((move, index) => line.moves[index] === move)
        if (valid && board.load({ moves: saved.moves }).status === 'accepted') {
          setupPlies = saved.setupPlies
          const liveGame = board.snapshot().moves
          // Rebuild checkpoint in the current game's identity, then restore live accepted history.
          board.load({ moves: liveGame })
          checkpoint = {
            ...board.saveCheckpoint(),
            game: { moves: liveGame.slice(0, setupPlies) },
          }
          state.phase = saved.phase
          state.targetRepetitions = saved.repetitions
          state.cleanRepetitions = saved.cleanRepetitions
          state.round = saved.round
          state.mistakes = saved.mistakes
          state.recalled = saved.recalled
          state.assisted = saved.assisted
          attempt = saved.attempt
          helped = saved.helped
          suggested = saved.suggested
          repetitionMistakes = saved.repetitionMistakes
          repetitionAssisted = saved.repetitionAssisted
          pendingReset = saved.pendingReset ?? false
          roundFinished = pendingReset
        } else state.message = 'stale-session'
      }
      advance()
    },
    submit(move: MoveInput) {
      submitMove(move)
    },
    requestHelp() {
      if (
        disposed ||
        state.status !== 'player' ||
        board.snapshot().viewedPly !== null
      )
        return
      helped = true
      repetitionAssisted = true
      state.message = 'solution'
      arrow(state.expectedSan, 'solution')
      persistSession()
      notify()
    },
    requestSuggestion() {
      if (
        disposed ||
        state.status !== 'player' ||
        state.phase === 'guided' ||
        board.snapshot().viewedPly !== null
      )
        return
      const suggestion = recommendMove({
        familyId: family.summary.id,
        side: state.side,
        positionKey: board.snapshot().positionKey,
        moves: state.available,
        memories,
        now: now(),
      })
      if (suggestion) {
        suggested = suggestion.san
        arrow(suggested, 'exploration')
        persistSession()
        notify()
      }
    },
    restart() {
      if (!disposed) controller.start(state.line.id, state.mode, state.side)
    },
    skip() {
      if (disposed || state.phase === 'complete') return
      cancel()
      record(
        outcome('-', board.snapshot().positionKey, 'skipped', false, 'round'),
      )
      state.status = 'complete'
      state.phase = 'complete'
      state.message = 'complete'
      board.configureInput({ input: 'disabled' })
      persistSession()
      notify()
    },
    viewHistory(ply) {
      if (disposed) return
      cancel()
      board.viewHistory(ply)
      if (ply === null && state.phase !== 'complete') advance()
      notify()
    },
    async retrySaving() {
      if (disposed) return
      const owner = writer
      const isCurrent = () =>
        !disposed &&
        writer === owner &&
        sessionWriters.get(repository) === owner
      await persistence
      if (!isCurrent()) return
      for (const event of [...pendingOutcomes.values()]) {
        const result = await repository.record(event)
        if (!isCurrent()) return
        if (result.status === 'failed') {
          saveError(result.message)
          return
        }
        pendingOutcomes.delete(event.id)
      }
      const result = await saveCurrentSession(savedSession(), owner)
      if (!isCurrent()) return
      state.persistenceError =
        result?.status === 'failed' ? result.message : null
      notify()
    },
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) return
      persistSession()
      cancel()
      disposed = true
      listeners.clear()
      board.configureInput({ input: 'disabled' })
    },
  }
  return controller
}
