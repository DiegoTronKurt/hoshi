import { BLACK, WHITE } from './types'
import type { Color } from './types'

const COORDINATE_LETTERS = 'abcdefghijklmnopqrstuvwxyz'

export function pointToSgf(width: number, point: number | null): string {
  if (point === null) return ''
  const x = point % width
  const y = Math.floor(point / width)
  return COORDINATE_LETTERS[x] + COORDINATE_LETTERS[y]
}

export function sgfToPoint(width: number, coord: string): number | null {
  if (!coord) return null
  const x = COORDINATE_LETTERS.indexOf(coord[0])
  const y = COORDINATE_LETTERS.indexOf(coord[1])
  return y * width + x
}

/**
 * Formatea la propiedad SZ segun el espec FF4: un solo numero para tablero
 * cuadrado, "ancho:alto" para rectangular (p.ej. el 9x13 de "Forma").
 */
export function formatSize(width: number, height: number): string {
  return width === height ? String(width) : `${width}:${height}`
}

/**
 * Inverso de `formatSize`. `SZ[9]` -> cuadrado 9x9; `SZ[9:13]` -> 9 de ancho,
 * 13 de alto. Antes de este arreglo, un `SZ` rectangular real (o escrito por
 * otra herramienta SGF) se leia con `Number("9:13")` -> `NaN`, corrompiendo
 * en silencio cualquier `sgfToPoint` posterior.
 */
export function parseSize(value: string): { width: number; height: number } {
  const [w, h] = value.split(':')
  const width = Number(w)
  const height = h !== undefined ? Number(h) : width
  return { width, height }
}

export interface SgfNode {
  properties: Record<string, string[]>
  children: SgfNode[]
}

export interface SgfGame {
  root: SgfNode
}

export function parseSgf(text: string): SgfGame {
  let i = 0

  function skipWhitespace(): void {
    while (i < text.length && /\s/.test(text[i])) i++
  }

  function parseNode(): SgfNode {
    i++ // consume ';'
    const properties: Record<string, string[]> = {}
    skipWhitespace()
    while (i < text.length && /[A-Za-z]/.test(text[i])) {
      let key = ''
      while (i < text.length && /[A-Za-z]/.test(text[i])) {
        key += text[i]
        i++
      }
      const values: string[] = []
      skipWhitespace()
      while (text[i] === '[') {
        i++ // consume '['
        let value = ''
        while (i < text.length && text[i] !== ']') {
          if (text[i] === '\\') {
            i++
            value += text[i]
            i++
          } else {
            value += text[i]
            i++
          }
        }
        i++ // consume ']'
        values.push(value)
        skipWhitespace()
      }
      properties[key] = values
      skipWhitespace()
    }
    return { properties, children: [] }
  }

  function parseSequence(): SgfNode[] {
    const nodes: SgfNode[] = []
    skipWhitespace()
    while (text[i] === ';') {
      nodes.push(parseNode())
      skipWhitespace()
    }
    return nodes
  }

  function parseGameTree(): SgfNode {
    i++ // consume '('
    const sequence = parseSequence()
    if (sequence.length === 0) {
      throw new Error('SGF invalido: arbol de jugadas sin nodos')
    }
    skipWhitespace()
    const variations: SgfNode[] = []
    while (text[i] === '(') {
      variations.push(parseGameTree())
      skipWhitespace()
    }
    if (text[i] === ')') i++

    for (let k = sequence.length - 1; k > 0; k--) {
      sequence[k - 1].children = [sequence[k]]
    }
    sequence[sequence.length - 1].children = variations
    return sequence[0]
  }

  skipWhitespace()
  if (text[i] !== '(') {
    throw new Error('SGF invalido: se esperaba "(" al inicio')
  }
  const root = parseGameTree()
  return { root }
}

export function writeSgf(game: SgfGame): string {
  function escapeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
  }

  function writeNode(node: SgfNode): string {
    let text = ';'
    for (const key of Object.keys(node.properties)) {
      text += key
      for (const value of node.properties[key]) {
        text += `[${escapeValue(value)}]`
      }
    }
    return text
  }

  function writeTree(node: SgfNode): string {
    let text = writeNode(node)
    if (node.children.length === 1) {
      text += writeTree(node.children[0])
    } else if (node.children.length > 1) {
      for (const child of node.children) {
        text += `(${writeTree(child)})`
      }
    }
    return text
  }

  return `(${writeTree(game.root)})`
}

export interface RecordedMove {
  color: Color
  point: number | null
}

/**
 * Serializa una partida lineal (sin variaciones) jugada desde el inicio.
 * Suficiente para guardar partidas propias; el arbol de refutaciones del
 * solucionador (con variaciones) se agrega en la fase del solucionador.
 */
export function gameRecordToSgf(width: number, height: number, komi: number, moves: RecordedMove[]): string {
  const root: SgfNode = {
    properties: {
      GM: ['1'],
      FF: ['4'],
      SZ: [formatSize(width, height)],
      KM: [String(komi)],
      RU: ['Chinese'],
    },
    children: [],
  }

  let current = root
  for (const move of moves) {
    const key = move.color === BLACK ? 'B' : 'W'
    const node: SgfNode = { properties: { [key]: [pointToSgf(width, move.point)] }, children: [] }
    current.children = [node]
    current = node
  }

  return writeSgf({ root })
}

export function sgfToGameRecord(text: string): { width: number; height: number; komi: number; moves: RecordedMove[] } {
  const { root } = parseSgf(text)
  const { width, height } = parseSize(root.properties.SZ?.[0] ?? '19')
  const komi = Number(root.properties.KM?.[0] ?? '0')
  const moves: RecordedMove[] = []

  let node: SgfNode | undefined = root
  while (node) {
    if (node.properties.B) moves.push({ color: BLACK, point: sgfToPoint(width, node.properties.B[0]) })
    if (node.properties.W) moves.push({ color: WHITE, point: sgfToPoint(width, node.properties.W[0]) })
    node = node.children[0]
  }

  return { width, height, komi, moves }
}
