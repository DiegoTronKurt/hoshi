import { parseSgf, pointToSgf, sgfToPoint, writeSgf } from '../core/sgf'
import type { SgfNode } from '../core/sgf'
import { createBoard } from '../core/board'
import { BLACK, WHITE, opponent } from '../core/types'
import type { BoardState, Color } from '../core/types'
import type { ConceptId } from '../analysis/concepts'
import type { Objective, RefutationNode } from '../solver/tsumego'

export interface Problem {
  conceptId: ConceptId
  board: BoardState
  /** Piedras del grupo objetivo en la posicion inicial. */
  targetPoints: number[]
  targetColor: Color
  toMove: Color
  objective: Objective
  tree: RefutationNode
}

function boardSetupProperties(board: BoardState): Record<string, string[]> {
  const ab: string[] = []
  const aw: string[] = []
  for (let p = 0; p < board.stones.length; p++) {
    if (board.stones[p] === BLACK) ab.push(pointToSgf(board.size, p))
    else if (board.stones[p] === WHITE) aw.push(pointToSgf(board.size, p))
  }
  const properties: Record<string, string[]> = {}
  if (ab.length > 0) properties.AB = ab
  if (aw.length > 0) properties.AW = aw
  return properties
}

const MAX_ATTACKER_REPLIES_STORED = 2
// Sin este limite, una forma muerta sin importar quien juegue primero (p.ej.
// cuadrado de cuatro) registra CADA intento de defensa del color objetivo,
// porque todos "cumplen el objetivo" (todos refutan igual) — eso hacia
// crecer una sola entrada del banco a mas de 200KB. Recortar tambien aca no
// le quita cobertura al ejercicio interactivo: la app valida cualquier
// jugada del usuario en vivo con el solucionador, no contra este arbol
// guardado (ver comentario mas abajo).
const MAX_DEFENDER_REPLIES_STORED = 2

/**
 * Serializa el arbol de refutaciones como variaciones SGF, usando las
 * propiedades estandar GB/GW ("good for black/white") para marcar si esa
 * jugada mantiene vivo al color objetivo. Se recorta para que quepa en un
 * archivo razonable: en los nodos del defensor solo se guardan como mucho
 * un par de las jugadas que efectivamente cumplen el objetivo (cualquiera
 * de ellas es una respuesta valida durante el ejercicio), y en los nodos
 * del atacante como mucho un par de respuestas representativas. La app
 * valida cualquier otra jugada correcta en el momento con el solucionador
 * en vivo, asi que este recorte no le quita cobertura al ejercicio
 * interactivo, solo al archivo guardado.
 */
function childrenToSgf(
  children: RefutationNode[],
  size: number,
  mover: Color,
  targetColor: Color,
  wantLive: boolean,
): SgfNode[] {
  const defenderToMove = mover === targetColor
  const kept = defenderToMove
    ? children.filter((c) => c.liveForDefender === wantLive).slice(0, MAX_DEFENDER_REPLIES_STORED)
    : children.slice(0, MAX_ATTACKER_REPLIES_STORED)

  return kept.map((child) => {
    const key = mover === BLACK ? 'B' : 'W'
    const properties: Record<string, string[]> = { [key]: [pointToSgf(size, child.move)] }
    const goodKey = targetColor === BLACK ? 'GB' : 'GW'
    properties[goodKey] = [child.liveForDefender ? '1' : '0']
    return {
      properties,
      children: childrenToSgf(child.children, size, opponent(mover), targetColor, wantLive),
    }
  })
}

export function problemToSgf(problem: Problem): string {
  const { board, targetPoints, targetColor, toMove, objective, conceptId, tree } = problem
  const wantLive = objective === 'live'
  const root: SgfNode = {
    properties: {
      GM: ['1'],
      FF: ['4'],
      SZ: [String(board.size)],
      ...boardSetupProperties(board),
      TR: targetPoints.map((p) => pointToSgf(board.size, p)),
      ZCONCEPT: [conceptId],
      ZOBJECTIVE: [objective],
      ZTARGET: [targetColor === BLACK ? 'B' : 'W'],
      PL: [toMove === BLACK ? 'B' : 'W'],
    },
    children: childrenToSgf(tree.children, board.size, toMove, targetColor, wantLive),
  }
  return writeSgf({ root })
}

function sgfToChildren(nodes: SgfNode[], size: number): RefutationNode[] {
  return nodes.map((node) => {
    const moveValue = node.properties.B?.[0] ?? node.properties.W?.[0] ?? ''
    const good = node.properties.GB?.[0] ?? node.properties.GW?.[0] ?? '0'
    return {
      move: sgfToPoint(size, moveValue),
      liveForDefender: good === '1',
      children: sgfToChildren(node.children, size),
    }
  })
}

export function sgfToProblem(text: string): Problem {
  const { root } = parseSgf(text)
  const size = Number(root.properties.SZ?.[0] ?? '9')
  const board = createBoard(size)

  for (const coord of root.properties.AB ?? []) {
    const point = sgfToPoint(size, coord)
    if (point !== null) board.stones[point] = BLACK
  }
  for (const coord of root.properties.AW ?? []) {
    const point = sgfToPoint(size, coord)
    if (point !== null) board.stones[point] = WHITE
  }

  const conceptId = root.properties.ZCONCEPT?.[0] as ConceptId
  const objective = root.properties.ZOBJECTIVE?.[0] as Objective
  const targetColor: Color = root.properties.ZTARGET?.[0] === 'B' ? BLACK : WHITE
  const toMove: Color = root.properties.PL?.[0] === 'B' ? BLACK : WHITE
  const targetPoints = (root.properties.TR ?? [])
    .map((coord) => sgfToPoint(size, coord))
    .filter((p): p is number => p !== null)

  const tree: RefutationNode = {
    move: null,
    liveForDefender: objective === 'live',
    children: sgfToChildren(root.children, size),
  }

  return { conceptId, board, targetPoints, targetColor, toMove, objective, tree }
}
