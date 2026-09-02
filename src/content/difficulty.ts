import type { RefutationNode } from '../solver/tsumego'
import type { Problem } from './problemSgf'

export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * Cuenta las jugadas del lado que resuelve el problema en la linea principal
 * del arbol de refutacion, siguiendo siempre la respuesta que el otro lado
 * necesitaria para seguir intentando. Es la misma logica que ya usaba
 * `tools/generate-problems.ts` para distinguir CAPTURA_SIMPLE (<=1) de
 * PUNTO_VITAL (>1) -- movida aca para reusarla tambien en las semillas
 * (`content/seeds.ts`) y etiquetar dificultad con el mismo criterio en
 * todo el banco, en vez de uno distinto por generador.
 */
export function solutionDepth(node: RefutationNode, wantLive: boolean, forDefender: boolean): number | null {
  if (node.children.length === 0) return 0
  let best: number | null = null
  for (const child of node.children) {
    const childIsWin = forDefender ? child.liveForDefender === wantLive : child.liveForDefender !== wantLive
    if (!forDefender) {
      const depth = solutionDepth(child, wantLive, !forDefender)
      if (depth !== null && (best === null || depth + 1 > best)) best = depth + 1
      continue
    }
    if (!childIsWin) continue
    const depth = solutionDepth(child, wantLive, !forDefender)
    if (depth !== null && (best === null || depth + 1 < best)) best = depth + 1
  }
  return best
}

/**
 * Umbrales calibrados contra la distribucion real del banco al momento de
 * escribir esto (`node /tmp/depth-check.mjs` sobre bank.json/ladders.json):
 * CAPTURA_SIMPLE/DOS_OJOS/doble atari son siempre profundidad 1 (faciles
 * por definicion), la mayoria de ESCALERA/RED_GETA cae en 2-4, y
 * SNAPBACK/OJO_FALSO/buena parte de NAKADE-PUNTO_VITAL en 5+. No son
 * umbrales arbitrarios elegidos antes de mirar los datos.
 */
export function difficultyFromDepth(depth: number | null): Difficulty {
  const d = depth ?? 1
  if (d <= 1) return 'easy'
  if (d <= 4) return 'medium'
  return 'hard'
}

export function tsumegoDifficulty(problem: Problem): Difficulty {
  const wantLive = problem.objective === 'live'
  const forDefender = problem.toMove === problem.targetColor
  return difficultyFromDepth(solutionDepth(problem.tree, wantLive, forDefender))
}
