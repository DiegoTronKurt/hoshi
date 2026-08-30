import type { TranslationKey } from '../../i18n'

export interface StrengthLevel {
  id: 'weak' | 'normal' | 'strong' | 'veryStrong'
  playouts: number
  labelKey: TranslationKey
}

export const STRENGTH_LEVELS: StrengthLevel[] = [
  { id: 'weak', playouts: 100, labelKey: 'play.strength.weak' },
  { id: 'normal', playouts: 500, labelKey: 'play.strength.normal' },
  { id: 'strong', playouts: 2000, labelKey: 'play.strength.strong' },
  { id: 'veryStrong', playouts: 8000, labelKey: 'play.strength.veryStrong' },
]
