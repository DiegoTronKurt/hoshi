import type { AttemptRecord, SavedGameRecord } from '../storage/db'

export interface StreakSummary {
  current: number
  longest: number
  activeToday: boolean
  lastActiveDate: string | null // 'YYYY-MM-DD', dia calendario local
}

/** 'YYYY-MM-DD' en el huso horario local (no UTC): la racha debe romperse a
 * la medianoche del usuario, no a la medianoche UTC. */
function toLocalDateKey(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Reconstruye una fecha local a partir de una clave 'YYYY-MM-DD'. A
 * proposito NO usa `new Date(key)`: un string de solo fecha se parsea como
 * medianoche UTC (spec de Date), lo que en husos horarios negativos corre
 * el dia un dia hacia atras al volver a leerlo en hora local. */
function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Racha de dias de practica (perfil de habilidad, "derivar, no persistir":
 * mismo patron que computeProfiles/currentLevel/planSession). Agrupa
 * createdAt de intentos y partidas por dia calendario local en un Set,
 * calcula `longest` como la racha consecutiva mas larga de todo el
 * historial, y `current` con periodo de gracia: si hoy tiene actividad,
 * cuenta hacia atras desde hoy (activeToday: true); si hoy no tiene
 * actividad pero ayer si, la racha se considera viva igual (activeToday:
 * false) -- recien se rompe si pasan dos dias locales completos sin
 * actividad. Esto evita mostrar "racha perdida" a las 9am de hoy antes de
 * haber practicado, cuando ayer si se practico.
 */
export function computeStreak(
  attempts: AttemptRecord[],
  games: SavedGameRecord[],
  now: Date = new Date(),
): StreakSummary {
  const activeDays = new Set<string>()
  for (const attempt of attempts) activeDays.add(toLocalDateKey(attempt.createdAt))
  for (const game of games) activeDays.add(toLocalDateKey(game.createdAt))

  if (activeDays.size === 0) {
    return { current: 0, longest: 0, activeToday: false, lastActiveDate: null }
  }

  const sortedDays = [...activeDays].sort()
  const lastActiveDate = sortedDays[sortedDays.length - 1]

  // longest: racha consecutiva mas larga en todo el historial.
  let longest = 1
  let run = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = parseDateKey(sortedDays[i - 1])
    const expectedNext = dateKeyFromDate(addDays(prev, 1))
    if (sortedDays[i] === expectedNext) {
      run++
    } else {
      run = 1
    }
    if (run > longest) longest = run
  }

  // current: cuenta hacia atras desde hoy (o desde ayer, en periodo de
  // gracia) mientras cada dia anterior este presente en el set.
  const todayKey = dateKeyFromDate(now)
  const yesterdayKey = dateKeyFromDate(addDays(now, -1))
  const activeToday = activeDays.has(todayKey)
  const activeYesterday = activeDays.has(yesterdayKey)

  if (!activeToday && !activeYesterday) {
    return { current: 0, longest, activeToday: false, lastActiveDate }
  }

  let current = 0
  let cursor = activeToday ? new Date(now) : addDays(now, -1)
  while (activeDays.has(dateKeyFromDate(cursor))) {
    current++
    cursor = addDays(cursor, -1)
  }

  return { current, longest, activeToday, lastActiveDate }
}
