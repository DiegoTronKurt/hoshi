import bankData from './problems/bank.json'
import laddersData from './problems/ladders.json'
import doubleAtariData from './problems/double-atari.json'
import atariIgnoradoData from './problems/atari-ignorado.json'
import autoatariData from './problems/autoatari.json'
import rellenoOjoPropioData from './problems/relleno-ojo-propio.json'
import trianguloVacioData from './problems/triangulo-vacio.json'
import corteNoDefendidoData from './problems/corte-no-defendido.json'
import areaValueData from './problems/area-value.json'
import yoseValueData from './problems/yose-value.json'
import semeaiLibertyData from './problems/semeai-liberty.json'
import { sgfToProblem } from './problemSgf'
import type { Problem } from './problemSgf'
import { sgfToLadderProblem } from './ladderProblem'
import type { LadderProblem } from './ladderProblem'
import { sgfToDoubleAtariProblem } from './doubleAtariProblem'
import type { DoubleAtariProblem } from './doubleAtariProblem'
import { sgfToAreaValueProblem } from './areaValueProblem'
import type { AreaValueProblem } from './areaValueProblem'
import { sgfToSemeaiLibertyProblem } from './semeaiLibertyProblem'
import type { SemeaiLibertyProblem } from './semeaiLibertyProblem'
import type { ConceptId } from '../analysis/concepts'
import type { Difficulty } from './difficulty'

export interface BankEntry {
  id: string
  conceptId: ConceptId
  sgf: string
  /** Calculada una vez en el generador (ver content/difficulty.ts), a partir
   * de cuantas jugadas de lectura hace falta para resolver el problema. No
   * se recalcula en el cliente, no cambia el mecanismo de Ejercicios: por
   * ahora es un dato interno, no un filtro visible en la interfaz. */
  difficulty: Difficulty
}

export type BankEntryKind = 'tsumego' | 'ladder' | 'doubleAtari' | 'areaValue' | 'semeaiLiberty'

export type LoadedProblem =
  | { kind: 'tsumego'; problem: Problem }
  | { kind: 'ladder'; problem: LadderProblem }
  | { kind: 'doubleAtari'; problem: DoubleAtariProblem }
  | { kind: 'areaValue'; problem: AreaValueProblem }
  | { kind: 'semeaiLiberty'; problem: SemeaiLibertyProblem }

const entries: BankEntry[] = [
  ...(bankData as BankEntry[]),
  ...(laddersData as BankEntry[]),
  ...(doubleAtariData as BankEntry[]),
  ...(atariIgnoradoData as BankEntry[]),
  ...(autoatariData as BankEntry[]),
  ...(rellenoOjoPropioData as BankEntry[]),
  ...(trianguloVacioData as BankEntry[]),
  ...(corteNoDefendidoData as BankEntry[]),
  ...(areaValueData as BankEntry[]),
  ...(yoseValueData as BankEntry[]),
  ...(semeaiLibertyData as BankEntry[]),
]

export function listBankEntries(conceptId?: ConceptId): BankEntry[] {
  if (!conceptId) return entries
  return entries.filter((entry) => entry.conceptId === conceptId)
}

/** ESCALERA, DOBLE_ATARI, los conceptos de valor de area (incluyendo los dos
 * de yose, que reusan el mismo formato con validacion mas estricta -- ver
 * areaValueProblem.ts) y los dos de libertades de semeai tienen su propio
 * formato de dato (ver ladderProblem.ts / doubleAtariProblem.ts /
 * areaValueProblem.ts / semeaiLibertyProblem.ts): no encajan en
 * Problem/solve(), asi que se distinguen por conceptId antes de elegir que
 * parser SGF usar. Ningun otro concepto usa estos seis, asi que el mapeo es
 * 1 a 1 y seguro. */
export function entryKind(entry: BankEntry): BankEntryKind {
  if (entry.conceptId === 'ESCALERA') return 'ladder'
  if (entry.conceptId === 'DOBLE_ATARI') return 'doubleAtari'
  if (
    entry.conceptId === 'RELLENO_TERRITORIO_PROPIO' ||
    entry.conceptId === 'PASE_PREMATURO' ||
    entry.conceptId === 'EL_FINAL_TAMBIEN_ES_GRANDE' ||
    entry.conceptId === 'COMPARAR_VALOR_REAL'
  )
    return 'areaValue'
  if (
    entry.conceptId === 'CONTAR_LIBERTADES_ANTES_DE_JUGAR' ||
    entry.conceptId === 'LIBERTADES_COMPARTIDAS_CUENTAN_DISTINTO'
  )
    return 'semeaiLiberty'
  return 'tsumego'
}

export function loadProblem(entry: BankEntry): Problem {
  return sgfToProblem(entry.sgf)
}

export function loadEntry(entry: BankEntry): LoadedProblem {
  const kind = entryKind(entry)
  if (kind === 'ladder') return { kind, problem: sgfToLadderProblem(entry.sgf) }
  if (kind === 'doubleAtari') return { kind, problem: sgfToDoubleAtariProblem(entry.sgf) }
  if (kind === 'areaValue') return { kind, problem: sgfToAreaValueProblem(entry.sgf) }
  if (kind === 'semeaiLiberty') return { kind, problem: sgfToSemeaiLibertyProblem(entry.sgf) }
  return { kind, problem: sgfToProblem(entry.sgf) }
}
