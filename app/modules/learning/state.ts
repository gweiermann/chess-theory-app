import { Chess } from 'chess.js'
import { DEFAULT_SETTINGS, progressKey, responseKey } from '../shared'
import type {
  LearningOutcome,
  LearningSnapshot,
  SavedSession,
  Settings,
} from '../shared'
import { nextMemory } from './review'

export interface Envelope {
  version: 1
  snapshot: LearningSnapshot
  eventIds: string[]
}
export const fresh = (): Envelope => ({
  version: 1,
  snapshot: {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    progress: {},
    memories: {},
    activity: [],
    session: null,
  },
  eventIds: [],
})
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const object = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 4096
const count = (value: unknown, maximum = 1e9): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= maximum
const timestamp = (value: unknown) => count(value, 8.64e15)
const side = (value: unknown) => value === 'white' || value === 'black'
const mode = (value: unknown) =>
  ['guided', 'sparring', 'review'].includes(value as string)
const safeKeys = (value: Record<string, unknown>) =>
  Object.keys(value).every(
    (key) =>
      !['__proto__', 'constructor', 'prototype'].includes(key) && text(key),
  )
const fields = (
  value: Record<string, unknown>,
  keys: string[],
  optional: string[] = [],
) =>
  Object.keys(value).every(
    (key) => keys.includes(key) || optional.includes(key),
  ) && keys.every((key) => Object.hasOwn(value, key))
const denseArray = (value: unknown): value is unknown[] =>
  Array.isArray(value) &&
  Object.keys(value).length === value.length &&
  Array.from({ length: value.length }, (_, index) => index).every((index) =>
    Object.hasOwn(value, index),
  )

export function validSettings(value: unknown): value is Settings {
  return (
    object(value) &&
    fields(value, [
      'side',
      'repetitions',
      'allowNew',
      'suggestions',
      'premoves',
      'autoSetup',
    ]) &&
    side(value.side) &&
    count(value.repetitions, 20) &&
    value.repetitions >= 1 &&
    ['automatic', 'on-request'].includes(value.suggestions as string) &&
    ['allowNew', 'premoves', 'autoSetup'].every(
      (key) => typeof value[key] === 'boolean',
    )
  )
}
export function validOutcome(value: unknown): value is LearningOutcome {
  return (
    object(value) &&
    fields(
      value,
      [
        'id',
        'at',
        'lineId',
        'familyId',
        'side',
        'mode',
        'positionKey',
        'move',
        'grade',
        'mistakes',
        'completed',
        'cleanRepetitions',
        'datasetRevision',
      ],
      ['kind', 'requiredRepetitions'],
    ) &&
    (!Object.hasOwn(value, 'requiredRepetitions') ||
      (count(value.requiredRepetitions, 20) &&
        value.requiredRepetitions >= 1)) &&
    (!Object.hasOwn(value, 'kind') ||
      value.kind === 'response' ||
      value.kind === 'round') &&
    [
      'id',
      'lineId',
      'familyId',
      'positionKey',
      'move',
      'datasetRevision',
    ].every((key) => text(value[key])) &&
    timestamp(value.at) &&
    side(value.side) &&
    mode(value.mode) &&
    ['recalled', 'retried', 'hinted', 'suggested', 'new', 'skipped'].includes(
      value.grade as string,
    ) &&
    count(value.mistakes) &&
    count(value.cleanRepetitions) &&
    typeof value.completed === 'boolean'
  )
}
export function validSession(value: unknown): value is SavedSession | null {
  if (value === null) return true
  if (
    !object(value) ||
    !fields(
      value,
      [
        'version',
        'datasetRevision',
        'lineId',
        'familyId',
        'side',
        'mode',
        'moves',
        'setupPlies',
        'repetitions',
        'cleanRepetitions',
        'mistakes',
        'assisted',
        'recalled',
        'round',
        'attempt',
        'helped',
        'suggested',
        'allowNew',
        'phase',
        'repetitionMistakes',
        'repetitionAssisted',
      ],
      ['pendingReset'],
    ) ||
    (Object.hasOwn(value, 'pendingReset') &&
      typeof value.pendingReset !== 'boolean') ||
    value.version !== 1 ||
    !['datasetRevision', 'lineId', 'familyId'].every((key) =>
      text(value[key]),
    ) ||
    !side(value.side) ||
    !mode(value.mode) ||
    !denseArray(value.moves) ||
    value.moves.length > 10000 ||
    !value.moves.every(text) ||
    ![
      'setupPlies',
      'repetitions',
      'cleanRepetitions',
      'mistakes',
      'assisted',
      'recalled',
      'round',
      'attempt',
      'repetitionMistakes',
    ].every((key) => count(value[key])) ||
    (value.setupPlies as number) > value.moves.length ||
    !count(value.repetitions, 20) ||
    value.repetitions < 1 ||
    !['helped', 'allowNew', 'repetitionAssisted'].every(
      (key) => typeof value[key] === 'boolean',
    ) ||
    !['guided', 'recall', 'sparring'].includes(value.phase as string) ||
    (value.mode === 'guided' && value.phase === 'sparring') ||
    (value.mode === 'review' && value.phase !== 'recall') ||
    (value.mode === 'sparring' && value.phase !== 'sparring') ||
    !(value.suggested === null || text(value.suggested))
  )
    return false
  try {
    const chess = new Chess()
    for (const move of value.moves) chess.move(move)
    return true
  } catch {
    return false
  }
}
export function validEnvelope(value: unknown): value is Envelope {
  if (
    !object(value) ||
    !fields(value, ['version', 'snapshot', 'eventIds']) ||
    value.version !== 1 ||
    !denseArray(value.eventIds) ||
    !value.eventIds.every(text) ||
    new Set(value.eventIds).size !== value.eventIds.length ||
    !object(value.snapshot)
  )
    return false
  const state = value.snapshot
  if (
    !fields(state, [
      'version',
      'settings',
      'progress',
      'memories',
      'activity',
      'session',
    ]) ||
    state.version !== 1 ||
    !validSettings(state.settings) ||
    !validSession(state.session) ||
    !object(state.progress) ||
    !safeKeys(state.progress) ||
    !object(state.memories) ||
    !safeKeys(state.memories) ||
    !denseArray(state.activity) ||
    state.activity.length > 500 ||
    !state.activity.every(validOutcome)
  )
    return false
  if (
    !Object.entries(state.progress).every(
      ([key, p]) =>
        object(p) &&
        fields(p, [
          'lineId',
          'side',
          'status',
          'cleanRepetitions',
          'lastPracticedAt',
        ]) &&
        text(p.lineId) &&
        side(p.side) &&
        key === progressKey(p.lineId, p.side as 'white' | 'black') &&
        ['practicing', 'mastered'].includes(p.status as string) &&
        count(p.cleanRepetitions) &&
        timestamp(p.lastPracticedAt),
    )
  )
    return false
  const eventIds = value.eventIds as string[]
  return (
    Object.values(state.memories).every(
      (m) =>
        object(m) &&
        fields(m, [
          'attempts',
          'mistakes',
          'assisted',
          'lastSeenAt',
          'dueAt',
        ]) &&
        ['attempts', 'mistakes', 'assisted'].every((key) => count(m[key])) &&
        timestamp(m.lastSeenAt) &&
        timestamp(m.dueAt),
    ) && state.activity.every((event) => eventIds.includes(event.id))
  )
}

export function applyOutcome(
  state: Envelope,
  event: LearningOutcome,
): Envelope {
  const next = copy(state)
  next.eventIds.push(event.id)
  next.snapshot.activity = [...next.snapshot.activity, copy(event)].slice(-500)
  const key = progressKey(event.lineId, event.side)
  const previous = next.snapshot.progress[key]
  next.snapshot.progress[key] = {
    lineId: event.lineId,
    side: event.side,
    status:
      previous?.status === 'mastered' ||
      (event.mode === 'guided' &&
        event.grade !== 'skipped' &&
        event.completed &&
        event.cleanRepetitions >=
          (event.requiredRepetitions ?? next.snapshot.settings.repetitions))
        ? 'mastered'
        : 'practicing',
    cleanRepetitions: Math.max(
      previous?.cleanRepetitions ?? 0,
      event.cleanRepetitions,
    ),
    lastPracticedAt: Math.max(previous?.lastPracticedAt ?? 0, event.at),
  }
  if (event.grade !== 'skipped' && event.kind !== 'round') {
    const memoryKey = responseKey(
      event.familyId,
      event.side,
      event.positionKey,
      event.move,
    )
    next.snapshot.memories[memoryKey] = nextMemory(
      next.snapshot.memories[memoryKey],
      event,
    )
  }
  return next
}
