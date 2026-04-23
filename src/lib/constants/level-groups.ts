/**
 * CANONICAL LEVEL GROUPS DEFINITION
 *
 * This is the single source of truth for academic level structure.
 * Levels are mapped to numeric values stored in the database (classes.level: INTEGER).
 *
 * Current mapping:
 * - Nursery: Not currently stored (future: -2, -1)
 * - KG: -1, 0
 * - Primary: 1-6
 * - JHS: 7-9
 *
 * Used by:
 * - Classes page (filtering, display)
 * - Subjects page (grouping, sorting)
 * - Students page (class assignment)
 * - Reports (level-aware formatting)
 * - Promotion logic (level progression)
 */

export const LEVEL_GROUPS = {
  NURSERY: {
    key: 'NURSERY',
    label: 'Nursery',
    description: 'Early childhood education',
    levels: ['Nursery 1', 'Nursery 2'],
    order: 1,
    numericLevels: [], // Not currently mapped to numeric storage
  },
  KG: {
    key: 'KG',
    label: 'Kindergarten',
    description: 'Kindergarten',
    levels: ['KG 1', 'KG 2'],
    order: 2,
    numericLevels: [-1, 0],
  },
  PRIMARY: {
    key: 'PRIMARY',
    label: 'Primary',
    description: 'Primary education',
    levels: ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'],
    order: 3,
    numericLevels: [1, 2, 3, 4, 5, 6],
  },
  JHS: {
    key: 'JHS',
    label: 'Junior High School',
    description: 'Junior secondary education',
    levels: ['JHS 1', 'JHS 2', 'JHS 3'],
    order: 4,
    numericLevels: [7, 8, 9],
  },
} as const

export type LevelGroupKey = keyof typeof LEVEL_GROUPS
export type AcademicLevel = (typeof LEVEL_GROUPS)[LevelGroupKey]

/**
 * Helper: Get all numeric levels across all groups
 */
export function getAllNumericLevels(): number[] {
  return Object.values(LEVEL_GROUPS)
    .flatMap((group) => group.numericLevels)
    .sort((a, b) => a - b)
}

/**
 * Helper: Get all level group keys in order
 */
export function getLevelGroupsInOrder(): LevelGroupKey[] {
  return Object.entries(LEVEL_GROUPS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key as LevelGroupKey)
}

/**
 * Helper: Get level group by key
 */
export function getLevelGroup(key: string): AcademicLevel | undefined {
  return LEVEL_GROUPS[key as LevelGroupKey]
}

/**
 * Helper: Find level group containing a numeric level
 */
export function getLevelGroupByNumber(numericLevel: number): AcademicLevel | undefined {
  return Object.values(LEVEL_GROUPS).find((group) => group.numericLevels.includes(numericLevel))
}

/**
 * Helper: Get label for numeric level (e.g., 1 -> "Primary 1")
 */
export function getNumericLevelLabel(numericLevel: number): string {
  const group = getLevelGroupByNumber(numericLevel)
  if (!group) return `Level ${numericLevel}`

  const indexInGroup = group.numericLevels.indexOf(numericLevel)
  if (indexInGroup === -1) return `Level ${numericLevel}`

  return group.levels[indexInGroup] ?? `Level ${numericLevel}`
}

/**
 * Helper: Validate if a numeric level is valid
 */
export function isValidNumericLevel(level: unknown): boolean {
  if (typeof level !== 'number') return false
  return getAllNumericLevels().includes(level)
}
