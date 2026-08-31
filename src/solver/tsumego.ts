import { bensonPassAlive } from '../core/benson'
import { applyMove, gameStateFromBoard } from '../core/rules'
import { EMPTY } from '../core/types'
import type { BoardState, Color, GameState } from '../core/types'

/**
 * Un grupo esta vivo de forma incondicional si al menos una de sus piedras
 * originales sigue en el tablero como parte de una cadena pass-alive
 * (algoritmo de Benson). Se usa tanto dentro del solucionador como en la
 * pantalla de ejercicios, para saber cuando un problema quedo resuelto.
 */
export function isGroupPassAlive(board: BoardState, targetPoints: number[], targetColor: Color): boolean {
  const survivors = targetPoints.filter((p) => board.stones[p] === targetColor)
  if (survivors.length === 0) return false
  const survivorSet = new Set(survivors)
  const { chains } = bensonPassAlive(board, targetColor)
  return chains.some((chain) => chain.some((p) => survivorSet.has(p)))
}

export type Objective = 'live' | 'kill'

export interface RefutationNode {
  /** La jugada que lleva a este nodo, o null si el nodo es terminal. */
  move: number | null
  /** true si, desde este nodo en adelante y con juego optimo, el color objetivo vive. */
  liveForDefender: boolean
  children: RefutationNode[]
}

export interface SolveRequest {
  board: BoardState
  region: number[]
  /** Piedras del grupo objetivo en la posicion de entrada. */
  targetPoints: number[]
  targetColor: Color
  toMove: Color
  objective: Objective
  maxDepth?: number
}

export interface SolveResult {
  solved: boolean
  root: RefutationNode
  nodesSearched: number
  hitDepthLimit: boolean
}

export const MAX_REGION_EMPTY_POINTS = 30
export const MAX_SEARCH_DEPTH = 14

/**
 * Solucionador exhaustivo de vida y muerte para una region acotada del
 * tablero. Dos simplificaciones deliberadas, ambas cubiertas por la regla del
 * proyecto de re-verificar cada problema del banco antes de aceptarlo:
 *
 * 1. Cualquier piedra que toque el borde de la region se trata como una
 *    pared fija (no se puede capturar). Es la tecnica estandar para resolver
 *    problemas locales sin analizar el tablero completo.
 * 2. No se explora "pasar" como jugada intermedia optativa, solo como
 *    consecuencia de no quedar jugadas legales dentro de la region. Pasar
 *    como jugada libre en cualquier nodo multiplicaba el arbol de busqueda
 *    sin aportar informacion nueva en un problema acotado (nadie tenukea en
 *    mitad de un tsumego), y hacia inviable el cacheo por posicion.
 */
export function solve(request: SolveRequest): SolveResult {
  const { board, region, targetPoints, targetColor, toMove, objective } = request
  const maxDepth = Math.min(request.maxDepth ?? MAX_SEARCH_DEPTH, MAX_SEARCH_DEPTH)
  const regionSet = new Set(region)
  const cache = new Map<string, RefutationNode>()
  let nodesSearched = 0
  let hitDepthLimit = false

  function isAliveAt(state: GameState): boolean {
    return isGroupPassAlive(state.board, targetPoints, targetColor)
  }

  function leaf(state: GameState): RefutationNode {
    return { move: null, liveForDefender: isAliveAt(state), children: [] }
  }

  function search(state: GameState, plyBudget: number): RefutationNode {
    nodesSearched++

    const positionHash = state.history[state.history.length - 1]
    const key = `${positionHash}:${state.toMove}`
    const cached = cache.get(key)
    if (cached) return cached

    const candidates: number[] = []
    for (const p of region) {
      if (state.board.stones[p] === EMPTY) candidates.push(p)
    }

    if (candidates.length === 0) {
      const node = leaf(state)
      cache.set(key, node)
      return node
    }

    if (plyBudget <= 0) {
      hitDepthLimit = true
      // No se cachea: a mas presupuesto disponible, otra rama si podria seguir buscando.
      return leaf(state)
    }

    const defenderToMove = state.toMove === targetColor
    const children: RefutationNode[] = []
    let decisive: RefutationNode | null = null

    for (const move of candidates) {
      const result = applyMove(state, move, { regionPoints: regionSet })
      if (!result.legal || !result.state) continue

      const child = search(result.state, plyBudget - 1)
      const node: RefutationNode = { move, liveForDefender: child.liveForDefender, children: child.children }
      children.push(node)

      const isWinningForMover = defenderToMove ? child.liveForDefender : !child.liveForDefender
      if (isWinningForMover && !decisive) decisive = node
    }

    if (children.length === 0) {
      // Ningun candidato resulto legal (por ejemplo, todos eran suicidio).
      const node = leaf(state)
      cache.set(key, node)
      return node
    }

    const liveForDefender = decisive ? decisive.liveForDefender : !defenderToMove
    const node: RefutationNode = { move: decisive?.move ?? null, liveForDefender, children }
    cache.set(key, node)
    return node
  }

  const initialState = gameStateFromBoard(board, toMove)
  const root = search(initialState, maxDepth)
  const solved = objective === 'live' ? root.liveForDefender : !root.liveForDefender

  return { solved, root, nodesSearched, hitDepthLimit }
}
