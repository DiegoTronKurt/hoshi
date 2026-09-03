import { LESSONS_N0 } from './n0'
import { LESSONS_N1 } from './n1'
import { LESSONS_N2 } from './n2'
import { LESSONS_N3 } from './n3'
import { LESSONS_N4 } from './n4'
import type { Lesson } from './types'

export type { Lesson, LessonBlock, DemoScript, DemoStep } from './types'

const ALL_LESSONS: Lesson[] = [...LESSONS_N0, ...LESSONS_N1, ...LESSONS_N2, ...LESSONS_N3, ...LESSONS_N4]

export function lessonsForLevel(level: 0 | 1 | 2 | 3 | 4 | 5 | 6): Lesson[] {
  return ALL_LESSONS.filter((lesson) => lesson.level === level).sort((a, b) => a.order - b.order)
}

export function getLesson(id: string): Lesson | null {
  return ALL_LESSONS.find((lesson) => lesson.id === id) ?? null
}
