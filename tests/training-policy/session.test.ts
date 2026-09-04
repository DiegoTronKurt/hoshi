import { describe, expect, it } from 'vitest'
import type { ConceptId } from '../../src/analysis/concepts'
import { toPoint } from '../../src/core/board'
import { gameRecordToSgf } from '../../src/core/sgf'
import type { RecordedMove } from '../../src/core/sgf'
import { BLACK, WHITE } from '../../src/core/types'
import type { BankEntry } from '../../src/content/problemBank'
import { Rating, createCard, reviewCard } from '../../src/learning/fsrs'
import type { ConceptProfile } from '../../src/learning/profile'
import { analyzeGame } from '../../src/analysis/mistakes'
import { findConceptsToReopen, findConceptsToReopenFromExercises, planSession } from '../../src/training-policy/session'
import type { AttemptRecord, SavedGameRecord, SrsCardRecord } from '../../src/storage/db'

const NOW = new Date('2026-01-10T00:00:00Z')

function day(n: number): string {
  return new Date(2026, 0, n).toISOString()
}

function entry(id: string, conceptId: ConceptId): BankEntry {
  return { id, conceptId, sgf: '', difficulty: 'easy' }
}

function emptyProfiles(): Record<ConceptId, ConceptProfile> {
  return {} as Record<ConceptId, ConceptProfile>
}

function profile(conceptId: ConceptId, score: number, correct: number, incorrect: number): ConceptProfile {
  return {
    conceptId,
    score,
    observationCount: correct + incorrect,
    correctCount: correct,
    incorrectCount: incorrect,
    lastPracticedAt: null,
    byContext: { exercise: { correct, incorrect }, game: { correct: 0, incorrect: 0 } },
  }
}

describe('planificador de sesion diaria', () => {
  it('sin tarjetas SRS, la sesion se completa entera con contenido nuevo', () => {
    const entries = [entry('p1', 'DOS_OJOS'), entry('p2', 'DOS_OJOS'), entry('p3', 'PUNTO_VITAL')]
    const plan = planSession(entries, [], emptyProfiles(), NOW, 1)
    expect(plan.items.length).toBeGreaterThan(0)
    expect(plan.items.every((i) => i.reason === 'new')).toBe(true)
  })

  it('prioriza los elementos vencidos de la cola SRS', () => {
    const entries = [entry('p1', 'DOS_OJOS'), entry('p2', 'DOS_OJOS'), entry('p3', 'PUNTO_VITAL')]
    const overdueCard = createCard(new Date('2026-01-01T00:00:00Z')) // vencida hace dias
    const futureCard = reviewCard(createCard(NOW), Rating.Good, NOW) // recien revisada, no vencida
    const cards: SrsCardRecord[] = [
      { problemId: 'p1', conceptId: 'DOS_OJOS', card: overdueCard },
      { problemId: 'p2', conceptId: 'DOS_OJOS', card: futureCard },
    ]
    const plan = planSession(entries, cards, emptyProfiles(), NOW, 10)
    const overdueItems = plan.items.filter((i) => i.reason === 'overdue')
    expect(overdueItems.map((i) => i.entry.id)).toContain('p1')
    expect(overdueItems.map((i) => i.entry.id)).not.toContain('p2')
  })

  it('incluye problemas de los conceptos mas debiles del perfil', () => {
    const entries = [entry('p1', 'AUTOATARI'), entry('p2', 'DOS_OJOS')]
    const profiles: Record<ConceptId, ConceptProfile> = {
      ...emptyProfiles(),
      AUTOATARI: profile('AUTOATARI', 10, 1, 4),
    }
    const plan = planSession(entries, [], profiles, NOW, 10)
    const weakItems = plan.items.filter((i) => i.reason === 'weak')
    expect(weakItems.some((i) => i.entry.id === 'p1')).toBe(true)
  })

  it('no repite el mismo problema en dos categorias', () => {
    const entries = [entry('p1', 'DOS_OJOS')]
    const overdueCard = createCard(new Date('2026-01-01T00:00:00Z'))
    const cards: SrsCardRecord[] = [{ problemId: 'p1', conceptId: 'DOS_OJOS', card: overdueCard }]
    const profiles: Record<ConceptId, ConceptProfile> = {
      ...emptyProfiles(),
      DOS_OJOS: profile('DOS_OJOS', 5, 0, 5),
    }
    const plan = planSession(entries, cards, profiles, NOW, 10)
    const ids = plan.items.map((i) => i.entry.id)
    expect(ids.length).toBe(new Set(ids).size)
  })
})

describe('findConceptsToReopen', () => {
  const SIZE = 9
  const p = (x: number, y: number) => toPoint(SIZE, x, y)

  // Misma secuencia ya verificada en tests/analysis/mistakes.test.ts
  // ("AUTOATARI: la jugada deja al propio grupo recien formado en atari sin
  // capturar"): dispara AUTOATARI en la jugada 7. Reutilizada tal cual en
  // vez de derivar una geometria nueva.
  const AUTOATARI_MOVES: RecordedMove[] = (() => {
    const coords: Array<[number, number]> = [
      [0, 0],
      [1, 2],
      [0, 1],
      [3, 2],
      [0, 2],
      [2, 1],
      [2, 2],
    ]
    let color = BLACK
    return coords.map(([x, y]) => {
      const move = { color, point: p(x, y) }
      color = color === BLACK ? WHITE : BLACK
      return move
    })
  })()

  // Una sola jugada de esquina, sin ningun patron de error: partida "limpia"
  // para las 5 posiciones del banco de pruebas de mas abajo.
  const CLEAN_MOVES: RecordedMove[] = [{ color: BLACK, point: p(4, 4) }]

  function savedGame(moves: RecordedMove[], createdAt: string): SavedGameRecord {
    return {
      createdAt,
      size: SIZE,
      komi: 0,
      mode: 'local',
      result: { black: 1, white: 0, winner: 'black' },
      sgf: gameRecordToSgf(SIZE, SIZE, 0, moves),
    }
  }

  it('reabre el concepto cuando aparece en 3 de las ultimas 5 partidas', () => {
    const games = [
      savedGame(AUTOATARI_MOVES, day(1)),
      savedGame(CLEAN_MOVES, day(2)),
      savedGame(AUTOATARI_MOVES, day(3)),
      savedGame(CLEAN_MOVES, day(4)),
      savedGame(AUTOATARI_MOVES, day(5)),
    ]
    expect(findConceptsToReopen(games)).toContain('AUTOATARI')
  })

  it('no reabre con solo 2 de 5 partidas', () => {
    const games = [
      savedGame(AUTOATARI_MOVES, day(1)),
      savedGame(CLEAN_MOVES, day(2)),
      savedGame(AUTOATARI_MOVES, day(3)),
      savedGame(CLEAN_MOVES, day(4)),
      savedGame(CLEAN_MOVES, day(5)),
    ]
    expect(findConceptsToReopen(games)).not.toContain('AUTOATARI')
  })

  it('solo mira las ultimas 5 partidas, no cualquier 3 de 5 en toda la historia', () => {
    const games = [
      savedGame(AUTOATARI_MOVES, day(1)),
      savedGame(AUTOATARI_MOVES, day(2)),
      savedGame(AUTOATARI_MOVES, day(3)),
      // Las 5 mas recientes son estas de aca, todas limpias.
      savedGame(CLEAN_MOVES, day(4)),
      savedGame(CLEAN_MOVES, day(5)),
      savedGame(CLEAN_MOVES, day(6)),
      savedGame(CLEAN_MOVES, day(7)),
      savedGame(CLEAN_MOVES, day(8)),
    ]
    expect(findConceptsToReopen(games)).not.toContain('AUTOATARI')
  })

  it('con menos de 5 partidas guardadas, el umbral de 3 igual dispara', () => {
    const games = [savedGame(AUTOATARI_MOVES, day(1)), savedGame(AUTOATARI_MOVES, day(2)), savedGame(AUTOATARI_MOVES, day(3))]
    expect(findConceptsToReopen(games)).toContain('AUTOATARI')
  })

  it('3 ocurrencias en UNA sola partida no alcanzan (se cuentan partidas, no ocurrencias)', () => {
    // Misma trampa de AUTOATARI_MOVES (esquina superior izquierda, jugada 7)
    // mas otras dos independientes (borde superior y borde inferior), las
    // tres dentro de esta unica partida. Si la funcion contara ocurrencias
    // en vez de partidas distintas, esto solo alcanzaria para disparar con
    // una sola partida -- lo que se quiere verificar es que NO dispara,
    // porque solo hay 1 partida en la ventana con el error, no 3.
    const threeInOneGame: RecordedMove[] = [
      ...AUTOATARI_MOVES, // 1-7: trampa 1, Negro cae en (2,2)
      { color: WHITE, point: p(5, 0) }, // 8: flanco trampa 2
      { color: BLACK, point: p(8, 8) }, // 9: relleno, sin relacion
      { color: WHITE, point: p(7, 0) }, // 10: flanco trampa 2
      { color: BLACK, point: p(6, 0) }, // 11: trampa 2, Negro cae
      { color: WHITE, point: p(5, 8) }, // 12: flanco trampa 3
      { color: BLACK, point: p(0, 8) }, // 13: relleno, sin relacion
      { color: WHITE, point: p(7, 8) }, // 14: flanco trampa 3
      { color: BLACK, point: p(6, 8) }, // 15: trampa 3, Negro cae
    ]
    // Confirma que el fixture realmente dispara 3 ocurrencias (no solo 1):
    // si esto fallara, el resto del test seria verdad por una razon
    // equivocada (cualquier partida con 1 sola ocurrencia tambien cumple
    // "no llega a 3 partidas").
    const occurrencesInGame = analyzeGame(SIZE, SIZE, 0, threeInOneGame).filter(
      (e) => e.conceptId === 'AUTOATARI' && e.result === 'incorrect',
    )
    expect(occurrencesInGame.length).toBe(3)

    const games = [
      savedGame(threeInOneGame, day(1)),
      savedGame(CLEAN_MOVES, day(2)),
      savedGame(CLEAN_MOVES, day(3)),
      savedGame(CLEAN_MOVES, day(4)),
      savedGame(CLEAN_MOVES, day(5)),
    ]
    expect(findConceptsToReopen(games)).not.toContain('AUTOATARI')
  })
})

describe('findConceptsToReopenFromExercises', () => {
  function attempt(conceptId: ConceptId, solved: boolean, createdAt: string): AttemptRecord {
    return { problemId: 'p', conceptId, createdAt, solved, wrongAttempts: solved ? 0 : 1 }
  }

  it('reabre el concepto con 3 fallos entre los ultimos 5 intentos DE ESE concepto', () => {
    const attempts = [
      attempt('AUTOATARI', false, day(1)),
      attempt('AUTOATARI', true, day(2)),
      attempt('AUTOATARI', false, day(3)),
      attempt('AUTOATARI', true, day(4)),
      attempt('AUTOATARI', false, day(5)),
    ]
    expect(findConceptsToReopenFromExercises(attempts)).toContain('AUTOATARI')
  })

  it('no reabre con solo 2 fallos de 5', () => {
    const attempts = [
      attempt('AUTOATARI', false, day(1)),
      attempt('AUTOATARI', true, day(2)),
      attempt('AUTOATARI', false, day(3)),
      attempt('AUTOATARI', true, day(4)),
      attempt('AUTOATARI', true, day(5)),
    ]
    expect(findConceptsToReopenFromExercises(attempts)).not.toContain('AUTOATARI')
  })

  it('la ventana es por concepto, no global: intentos de otro concepto no cuentan ni desplazan la ventana', () => {
    const attempts = [
      attempt('AUTOATARI', false, day(1)),
      attempt('AUTOATARI', false, day(2)),
      attempt('DOS_OJOS', false, day(3)),
      attempt('DOS_OJOS', false, day(4)),
      attempt('DOS_OJOS', false, day(5)),
      attempt('AUTOATARI', false, day(6)),
    ]
    expect(findConceptsToReopenFromExercises(attempts)).toContain('AUTOATARI')
    expect(findConceptsToReopenFromExercises(attempts)).toContain('DOS_OJOS')
  })

  it('solo mira los ultimos 5 intentos del concepto, no cualquier 3 fallos en toda la historia', () => {
    const attempts = [
      attempt('AUTOATARI', false, day(1)),
      attempt('AUTOATARI', false, day(2)),
      attempt('AUTOATARI', false, day(3)),
      // Los 5 mas recientes de AUTOATARI son estos de aca, todos resueltos.
      attempt('AUTOATARI', true, day(4)),
      attempt('AUTOATARI', true, day(5)),
      attempt('AUTOATARI', true, day(6)),
      attempt('AUTOATARI', true, day(7)),
      attempt('AUTOATARI', true, day(8)),
    ]
    expect(findConceptsToReopenFromExercises(attempts)).not.toContain('AUTOATARI')
  })

  it('con menos de 5 intentos del concepto, el umbral de 3 igual dispara', () => {
    const attempts = [attempt('AUTOATARI', false, day(1)), attempt('AUTOATARI', false, day(2)), attempt('AUTOATARI', false, day(3))]
    expect(findConceptsToReopenFromExercises(attempts)).toContain('AUTOATARI')
  })
})
