import type { Catalog, Family, OpeningLine } from '../shared'
export type {
  Catalog,
  Family,
  OpeningLine,
  TopicSummary,
  FamilySummary,
} from '../shared'
export interface OpeningLibrary {
  catalog(): Promise<Catalog>
  family(id: string): Promise<Family>
  line(familyId: string, lineId: string): Promise<OpeningLine | null>
}
export interface Repertoire {
  matching(history: readonly string[]): readonly OpeningLine[]
  continuations(history: readonly string[]): readonly string[]
  complete(history: readonly string[]): boolean
}
