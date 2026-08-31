import bankData from './problems/bank.json'
import { sgfToProblem } from './problemSgf'
import type { Problem } from './problemSgf'
import type { ConceptId } from '../analysis/concepts'

export interface BankEntry {
  id: string
  conceptId: ConceptId
  sgf: string
}

const entries = bankData as BankEntry[]

export function listBankEntries(conceptId?: ConceptId): BankEntry[] {
  if (!conceptId) return entries
  return entries.filter((entry) => entry.conceptId === conceptId)
}

export function loadProblem(entry: BankEntry): Problem {
  return sgfToProblem(entry.sgf)
}
