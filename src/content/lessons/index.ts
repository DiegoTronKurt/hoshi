import { LESSONS_N0 } from './n0'
import { LESSONS_N1 } from './n1'
import { LESSONS_N2 } from './n2'
import { LESSONS_N3 } from './n3'
import { LESSONS_N4 } from './n4'
import { LESSONS_N5 } from './n5'
import { LESSONS_N6 } from './n6'
import { LESSONS_N7 } from './n7'
import { LESSONS_N8 } from './n8'
import { LESSONS_N9 } from './n9'
import { LESSONS_N10 } from './n10'
import type { Lesson } from './types'

export type { Lesson, LessonBlock, DemoScript, DemoStep } from './types'

const ALL_LESSONS: Lesson[] = [
  ...LESSONS_N0,
  ...LESSONS_N1,
  ...LESSONS_N2,
  ...LESSONS_N3,
  ...LESSONS_N4,
  ...LESSONS_N5,
  ...LESSONS_N6,
  ...LESSONS_N7,
  ...LESSONS_N8,
  ...LESSONS_N9,
  ...LESSONS_N10,
]

export function lessonsForLevel(level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10): Lesson[] {
  return ALL_LESSONS.filter((lesson) => lesson.level === level).sort((a, b) => a.order - b.order)
}

export function getLesson(id: string | null): Lesson | null {
  if (id === null) return null
  return ALL_LESSONS.find((lesson) => lesson.id === id) ?? null
}
