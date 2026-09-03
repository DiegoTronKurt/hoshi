/**
 * Genera un PDF de muestra para que un jugador real de Go revise contenido
 * (gate de revision de v1, pendiente desde antes de v2 -- ver conversacion
 * con el usuario). Corre fuera de la app con `npm run review:export`.
 *
 * Selecciona ~3 problemas por cada uno de los 9 conceptos que generan
 * ejercicios (con reparto por dificultad facil/media/dificil cuando el
 * concepto tiene las tres), mas las lecciones de nivel 0-2 completas.
 *
 * La jugada "correcta" de cada problema NUNCA se escribe a mano: sale de
 * `solve()`/`solveLadder()` con el mismo regimen que usa la pantalla real
 * (`useSolvableExercise.ts`: computeRegion margin=1, maxDepth=8), o de
 * `expectedPoints` para doble atari (el unico caso donde el dato ya viene
 * dado sin ambiguedad). Mismo principio que ya sigue el resto del proyecto.
 *
 * El HTML intermedio se arma a mano (sin la app React: esto corre en Node,
 * no en un navegador) y se convierte a PDF con Playwright, que ya es
 * devDependency del proyecto -- cero dependencias nuevas.
 */
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { listBankEntries, loadEntry } from '../src/content/problemBank'
import type { BankEntry } from '../src/content/problemBank'
import { solve } from '../src/solver/tsumego'
import { computeRegion } from '../src/solver/region'
import { solveLadder } from '../src/solver/ladder'
import { bestAreaMove } from '../src/solver/areaValue'
import { getGroup } from '../src/core/groups'
import { toXY } from '../src/core/board'
import { BLACK, EMPTY } from '../src/core/types'
import type { BoardState, Color } from '../src/core/types'
import { CONCEPTS, conceptsThatGenerateExercises } from '../src/analysis/concepts'
import type { Difficulty } from '../src/content/difficulty'
import { lessonsForLevel } from '../src/content/lessons'
import type { Lesson, LessonBlock } from '../src/content/lessons'
import { getHoshiPoints } from '../src/ui/board/hoshiPoints'
import es from '../src/i18n/locales/es.json'
import en from '../src/i18n/locales/en.json'

const SOLVE_MAX_DEPTH = 8 // igual que SOLVE_MAX_DEPTH en useSolvableExercise.ts
const PER_CONCEPT_QUOTA = 3 // 9 conceptos x 3 = 27, dentro del rango 20-30 pedido
const LOCALE: 'es' | 'en' = 'es'

const dict = LOCALE === 'es' ? (es as Record<string, string>) : (en as Record<string, string>)
const fallbackDict = en as Record<string, string>

function t(key: string, params?: Record<string, string | number>): string {
  const template = dict[key] ?? fallbackDict[key] ?? key
  if (!params) return template
  // Misma logica de interpolacion que I18nContext.t en src/i18n/index.tsx.
  return template.replace(/{{(\w+)}}/g, (match, name) => String(params[name] ?? match))
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' }
const COLOR_LABEL: Record<Color, string> = { [BLACK]: 'Negro', 2: 'Blanco' } as Record<Color, string>
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ' // sin I, convencion estandar de diagramas de Go

function coordLabel(width: number, height: number, point: number): string {
  const [x, y] = toXY(width, point)
  return `${COLUMN_LETTERS[x]}${height - y}`
}

// ---------------------------------------------------------------------------
// Seleccion de la muestra: ~3 por concepto, con reparto de dificultad.
// ---------------------------------------------------------------------------

function pickSample(): BankEntry[] {
  const conceptIds = conceptsThatGenerateExercises().map((c) => c.id)
  const order: Difficulty[] = ['easy', 'medium', 'hard']
  const selected: BankEntry[] = []

  for (const id of conceptIds) {
    const entries = listBankEntries(id)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    const byDifficulty: Record<Difficulty, BankEntry[]> = { easy: [], medium: [], hard: [] }
    for (const entry of entries) byDifficulty[entry.difficulty].push(entry)

    const chosen: BankEntry[] = []
    const used = new Set<string>()
    let round = 0
    while (chosen.length < PER_CONCEPT_QUOTA && chosen.length < entries.length) {
      const bucket = byDifficulty[order[round % order.length]]
      const next = bucket.find((entry) => !used.has(entry.id))
      if (next) {
        chosen.push(next)
        used.add(next.id)
      }
      round++
    }
    selected.push(...chosen)
  }
  return selected
}

// ---------------------------------------------------------------------------
// Resolver cada problema con el motor real (nunca a mano).
// ---------------------------------------------------------------------------

interface SolvedProblem {
  entry: BankEntry
  board: BoardState
  toMove: Color
  objectiveLabel: string
  targetPoints: number[]
  correctPoints: number[]
}

function solveEntry(entry: BankEntry): SolvedProblem {
  const loaded = loadEntry(entry)

  if (loaded.kind === 'tsumego') {
    const problem = loaded.problem
    const region = computeRegion(problem.board, problem.targetPoints, 1)
    const result = solve({
      board: problem.board,
      region,
      targetPoints: problem.targetPoints,
      targetColor: problem.targetColor,
      toMove: problem.toMove,
      objective: problem.objective,
      maxDepth: SOLVE_MAX_DEPTH,
      pruneAfterDecisive: true,
    })
    if (!result.solved || result.root.move === null) {
      throw new Error(
        `Problema ${entry.id} (${entry.conceptId}) no resuelve con el regimen en vivo (margin=1) -- inesperado, revisar el banco antes de seguir.`,
      )
    }
    return {
      entry,
      board: problem.board,
      toMove: problem.toMove,
      objectiveLabel: problem.objective === 'live' ? 'vivir' : 'matar',
      targetPoints: problem.targetPoints,
      correctPoints: [result.root.move],
    }
  }

  if (loaded.kind === 'ladder') {
    const problem = loaded.problem
    const result = solveLadder({ board: problem.board, runnerPoint: problem.runnerPoint, chaserColor: problem.chaserColor })
    if (!result.captured || result.moves.length === 0) {
      throw new Error(`Escalera ${entry.id} no captura segun solveLadder -- inesperado, revisar el banco antes de seguir.`)
    }
    return {
      entry,
      board: problem.board,
      toMove: problem.chaserColor,
      objectiveLabel: 'capturar en escalera',
      targetPoints: getGroup(problem.board, problem.runnerPoint).stones,
      correctPoints: [result.moves[0]],
    }
  }

  if (loaded.kind === 'areaValue') {
    const problem = loaded.problem
    const best = bestAreaMove(problem.board, problem.toMove)
    return {
      entry,
      board: problem.board,
      toMove: problem.toMove,
      objectiveLabel: 'valor de área (jugar o pasar)',
      targetPoints: [],
      // best === null es un resultado legitimo (RELLENO_TERRITORIO_PROPIO:
      // la jugada correcta es pasar, sin coordenada que marcar) -- ver
      // renderProblemSection, que ya maneja correctPoints vacio.
      correctPoints: best ? [best.point] : [],
    }
  }

  const problem = loaded.problem
  return {
    entry,
    board: problem.board,
    toMove: problem.color,
    objectiveLabel: 'doble atari',
    targetPoints: [],
    correctPoints: problem.expectedPoints,
  }
}

// ---------------------------------------------------------------------------
// Diagrama SVG. Misma matematica de layout que BoardCanvas.tsx (sin invertir
// el eje Y, margin = cell, stoneRadius = cell * 0.46) para que el diagrama
// impreso coincida con lo que se ve en la app.
// ---------------------------------------------------------------------------

interface BoardMarks {
  targetPoints?: number[]
  correctPoints?: number[]
}

function renderBoardSvg(board: BoardState, marks: BoardMarks = {}): string {
  const { width, height, stones } = board
  const cell = 30
  const margin = cell + 14
  const svgW = margin * 2 + (width - 1) * cell
  const svgH = margin * 2 + (height - 1) * cell
  const parts: string[] = [`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff" />`]

  for (let x = 0; x < width; x++) {
    const px = margin + x * cell
    parts.push(`<line x1="${px}" y1="${margin}" x2="${px}" y2="${margin + (height - 1) * cell}" stroke="#666666" stroke-width="1" />`)
  }
  for (let y = 0; y < height; y++) {
    const py = margin + y * cell
    parts.push(`<line x1="${margin}" y1="${py}" x2="${margin + (width - 1) * cell}" y2="${py}" stroke="#666666" stroke-width="1" />`)
  }

  for (const point of getHoshiPoints(width, height)) {
    const [x, y] = toXY(width, point)
    parts.push(`<circle cx="${margin + x * cell}" cy="${margin + y * cell}" r="3" fill="#666666" />`)
  }

  for (const point of marks.targetPoints ?? []) {
    const [x, y] = toXY(width, point)
    const cx = margin + x * cell
    const cy = margin + y * cell
    parts.push(`<rect x="${cx - cell * 0.5}" y="${cy - cell * 0.5}" width="${cell}" height="${cell}" fill="none" stroke="#c98a1f" stroke-width="2.5" />`)
  }

  const stoneRadius = cell * 0.46
  for (let p = 0; p < stones.length; p++) {
    const value = stones[p]
    if (value === EMPTY) continue
    const [x, y] = toXY(width, p)
    const cx = margin + x * cell
    const cy = margin + y * cell
    const fill = value === BLACK ? '#1a1a1a' : '#f7f7f2'
    const stroke = value === BLACK ? '#000000' : '#333333'
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${stoneRadius}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" />`)
  }

  for (const point of marks.correctPoints ?? []) {
    const [x, y] = toXY(width, point)
    const cx = margin + x * cell
    const cy = margin + y * cell
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${stoneRadius * 0.62}" fill="none" stroke="#1c5fa8" stroke-width="3" />`)
    parts.push(`<circle cx="${cx}" cy="${cy}" r="2.2" fill="#1c5fa8" />`)
  }

  for (let x = 0; x < width; x++) {
    const px = margin + x * cell
    parts.push(
      `<text x="${px}" y="${margin + (height - 1) * cell + margin * 0.62}" font-size="11" fill="#555555" text-anchor="middle" font-family="Arial, sans-serif">${COLUMN_LETTERS[x]}</text>`,
    )
  }
  for (let y = 0; y < height; y++) {
    const py = margin + y * cell
    parts.push(
      `<text x="${margin * 0.4}" y="${py + 4}" font-size="11" fill="#555555" text-anchor="middle" font-family="Arial, sans-serif">${height - y}</text>`,
    )
  }

  return `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

// ---------------------------------------------------------------------------
// Secciones HTML.
// ---------------------------------------------------------------------------

function renderLessonSection(lesson: Lesson): string {
  const blocksHtml = lesson.blocks
    .map((block: LessonBlock) => {
      if (block.kind === 'paragraph') return `<p>${escapeHtml(t(block.textKey))}</p>`
      const svg = renderBoardSvg({ width: block.width, height: block.height, stones: block.stones }, {
        correctPoints: block.highlightPoint !== undefined ? [block.highlightPoint] : [],
      })
      return `<div class="diagram">${svg}<div class="caption">${escapeHtml(t(block.captionKey, block.captionParams))}</div></div>`
    })
    .join('\n')

  const demoHtml = lesson.demo
    ? `<div class="diagram">${renderBoardSvg({ width: lesson.demo.width, height: lesson.demo.height, stones: lesson.demo.initialStones })}<div class="caption">Posición inicial del ejemplo interactivo (turno: ${COLOR_LABEL[lesson.demo.toMove]}). La secuencia completa de pasos solo existe en la app.</div></div>`
    : ''

  return `<section class="item">
    <h3>${escapeHtml(lesson.id)} — ${escapeHtml(t(lesson.titleKey))}</h3>
    <div class="meta">Nivel ${lesson.level}</div>
    ${blocksHtml}
    ${demoHtml}
  </section>`
}

function renderProblemSection(solved: SolvedProblem): string {
  const concept = CONCEPTS[solved.entry.conceptId]
  const svg = renderBoardSvg(solved.board, { targetPoints: solved.targetPoints, correctPoints: solved.correctPoints })
  // correctPoints vacio es un resultado legitimo para RELLENO_TERRITORIO_PROPIO
  // (la jugada correcta es pasar): no hay coordenada ni circulo que mostrar.
  const correctLabels =
    solved.correctPoints.length > 0
      ? solved.correctPoints.map((p) => coordLabel(solved.board.width, solved.board.height, p)).join(', ')
      : 'Pasar'
  const correctHint = solved.correctPoints.length > 0 ? ' <span class="hint">(círculo azul en el diagrama)</span>' : ''

  return `<section class="item">
    <h3>${escapeHtml(solved.entry.id)} — ${escapeHtml(t(concept.labelKey))} <span class="tag">${DIFFICULTY_LABEL[solved.entry.difficulty]}</span></h3>
    <div class="board-row">
      ${svg}
      <div class="details">
        <p class="meta">Turno: ${COLOR_LABEL[solved.toMove]}. Objetivo: ${solved.objectiveLabel}.</p>
        <p class="meta"><strong>Jugada correcta:</strong> ${escapeHtml(correctLabels)}${correctHint}</p>
        <p>${escapeHtml(t(concept.summaryKey))}</p>
      </div>
    </div>
  </section>`
}

// ---------------------------------------------------------------------------
// Documento completo.
// ---------------------------------------------------------------------------

function buildHtmlDocument(lessons: Lesson[], problems: SolvedProblem[]): string {
  const byConceptCount = new Map<string, number>()
  for (const p of problems) byConceptCount.set(p.entry.conceptId, (byConceptCount.get(p.entry.conceptId) ?? 0) + 1)

  const conceptSummaryRows = conceptsThatGenerateExercises()
    .map((c) => `<tr><td>${escapeHtml(t(c.labelKey))}</td><td>${byConceptCount.get(c.id) ?? 0}</td></tr>`)
    .join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Hoshi — revisión de contenido</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; font-size: 13px; line-height: 1.45; }
  h1, h2, h3, .tag, .meta, .caption, .hint { font-family: Arial, Helvetica, sans-serif; }
  h1 { font-size: 22px; }
  h2 { font-size: 17px; margin-top: 0; padding-top: 10mm; border-top: 2px solid #1a1a1a; }
  h3 { font-size: 14px; margin-bottom: 4px; }
  .cover { break-after: page; padding-top: 30mm; }
  .cover p { font-size: 14px; }
  .cover table { border-collapse: collapse; margin-top: 8mm; font-size: 12px; }
  .cover td { border: 1px solid #ccc; padding: 3px 10px; }
  section.item { break-inside: avoid; margin: 0 0 20px 0; padding-bottom: 14px; border-bottom: 1px solid #ddd; }
  .board-row { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
  .details { flex: 1; min-width: 180px; }
  .meta { font-size: 12px; color: #444; margin: 3px 0; }
  .tag { font-size: 11px; background: #eee; border-radius: 3px; padding: 1px 6px; font-weight: normal; }
  .caption { font-size: 12px; color: #444; margin: 4px 0 10px 0; max-width: 380px; }
  .hint { font-size: 11px; color: #1c5fa8; }
  .diagram { margin: 6px 0; }
  .level-block { break-before: page; }
</style>
</head>
<body>
  <section class="cover">
    <h1>Hoshi — paquete de revisión de contenido</h1>
    <p>Muestra representativa para revisión por un jugador real de Go. Ninguna afirmación de "jugada correcta" en este documento fue escrita a mano: cada una sale del mismo solucionador y régimen (margen de región, profundidad máxima) que usa la app en vivo.</p>
    <p><strong>Cómo marcar comentarios:</strong> cada problema tiene su id (p.ej. "p57") y cada casilla se puede nombrar por su coordenada (p.ej. "D4", columnas A-T sin la I, filas de abajo hacia arriba). El círculo azul marca la jugada correcta; el cuadrado ámbar marca el grupo objetivo del problema.</p>
    <table>
      <tr><td><strong>Lecciones incluidas</strong></td><td>${lessons.length} (niveles 0-2)</td></tr>
      <tr><td><strong>Problemas incluidos</strong></td><td>${problems.length}</td></tr>
      ${conceptSummaryRows}
    </table>
  </section>

  <h2 class="level-block">Lecciones (niveles 0–2)</h2>
  ${lessons.map(renderLessonSection).join('\n')}

  <h2 class="level-block">Problemas de muestra (banco)</h2>
  ${problems.map(renderProblemSection).join('\n')}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const sample = pickSample()
  console.log(`Muestra seleccionada: ${sample.length} problemas.`)
  const solved = sample.map(solveEntry)

  const lessons = [0, 1, 2].flatMap((level) => lessonsForLevel(level as 0 | 1 | 2))
  console.log(`Lecciones incluidas: ${lessons.length} (niveles 0-2).`)

  const html = buildHtmlDocument(lessons, solved)

  const root = dirname(fileURLToPath(import.meta.url))
  const outDir = join(root, 'output')
  await mkdir(outDir, { recursive: true })
  const htmlPath = join(tmpdir(), `hoshi-review-${Date.now()}.html`)
  const pdfPath = join(outDir, 'revision-contenido-muestra.pdf')

  await writeFile(htmlPath, html, 'utf8')

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`)
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true })
  } finally {
    await browser.close()
    await rm(htmlPath, { force: true })
  }

  console.log(`PDF generado en: ${pdfPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
