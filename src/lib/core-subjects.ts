import { createClient } from '@supabase/supabase-js'
import type { Subject } from '@/types'

export interface CoreSubject {
  name: string
  code: string
  description: string
}

interface SubjectInsert {
  school_id: string
  level_group: string
  name: string
  code: string
  description: string
  is_core: boolean
  is_active: boolean
}

export const CORE_SUBJECTS_BY_LEVEL: Record<string, CoreSubject[]> = {
  PRIMARY: [
    { name: 'English Language', code: 'ENG', description: 'Communication and language skills' },
    { name: 'Mathematics', code: 'MATH', description: 'Mathematical concepts and problem solving' },
    { name: 'Science', code: 'SCI', description: 'Basic scientific principles and understanding' },
    { name: 'Ghanaian Language', code: 'GH_LANG', description: 'Ghanaian language and culture' },
  ],
  JHS: [
    { name: 'English Language', code: 'ENG', description: 'Communication and language skills' },
    { name: 'Mathematics', code: 'MATH', description: 'Mathematical concepts and problem solving' },
    { name: 'Integrated Science', code: 'SCI', description: 'Integrated science principles' },
    { name: 'Social Studies', code: 'SOC', description: 'Social sciences and civic education' },
  ],
  KG: [
    { name: 'Language & Literacy', code: 'KG_LANG', description: 'Early language and literacy skills' },
    { name: 'Numeracy', code: 'KG_NUM', description: 'Early numeracy skills' },
    { name: 'Ghanaian Language', code: 'KG_GH_LANG', description: 'Ghanaian language and culture' },
  ],
}

// Legacy flat list for backward compatibility
export const CORE_SUBJECTS: CoreSubject[] = Object.values(CORE_SUBJECTS_BY_LEVEL).flat()

/**
 * Creates core subjects for a school if they don't exist
 * @param supabase - Supabase client
 * @param schoolId - School ID to create subjects for
 * @returns Promise with creation results
 */
export async function ensureCoreSubjects(
  supabase: ReturnType<typeof createClient>,
  schoolId: string,
  levelGroups?: string[]
): Promise<{ success: boolean; message: string; created: number }> {
  try {
    const targetLevels = levelGroups ?? Object.keys(CORE_SUBJECTS_BY_LEVEL)
    let totalCreated = 0

    for (const levelGroup of targetLevels) {
      const subjectsForLevel = CORE_SUBJECTS_BY_LEVEL[levelGroup]
      if (!subjectsForLevel) continue

      const { data: existingSubjects, error: fetchError } = await supabase
        .from('subjects')
        .select('code')
        .eq('school_id', schoolId)
        .eq('level_group', levelGroup)
        .eq('is_core', true)

      if (fetchError) {
        throw new Error(`Failed to fetch existing subjects for ${levelGroup}: ${fetchError.message}`)
      }

      const existingCodes = new Set((existingSubjects as Pick<Subject, 'code'>[])?.map(s => s.code) || [])
      const subjectsToCreate = subjectsForLevel.filter(subject => !existingCodes.has(subject.code))

      if (subjectsToCreate.length === 0) continue

      const subjectData: SubjectInsert[] = subjectsToCreate.map(subject => ({
        school_id: schoolId,
        level_group: levelGroup,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        is_core: true,
        is_active: true,
      }))

      const { error: createError } = await (supabase
        .from('subjects') as unknown as {
          insert: (data: SubjectInsert[]) => Promise<{ error: Error | null }>
        })
        .insert(subjectData)

      if (createError) {
        throw new Error(`Failed to create core subjects for ${levelGroup}: ${createError.message}`)
      }

      totalCreated += subjectsToCreate.length
    }

    if (totalCreated === 0) {
      return { success: true, message: 'All core subjects already exist', created: 0 }
    }

    return { success: true, message: `Created ${totalCreated} core subjects`, created: totalCreated }

  } catch (error) {
    console.error('Error ensuring core subjects:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      created: 0
    }
  }
}

/**
 * Get all subjects for a school, grouped by core/elective
 * @param supabase - Supabase client
 * @param schoolId - School ID
 */
export async function getSchoolSubjects(
  supabase: ReturnType<typeof createClient>,
  schoolId: string
) {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .order('is_core', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch subjects: ${error.message}`)
  }

  const typedSubjects = subjects as Subject[] || []
  const coreSubjects = typedSubjects.filter(s => s.is_core)
  const electiveSubjects = typedSubjects.filter(s => !s.is_core)

  return {
    coreSubjects,
    electiveSubjects,
    allSubjects: typedSubjects
  }
}

/**
 * Validate if a school has all required core subjects
 * @param supabase - Supabase client
 * @param schoolId - School ID
 */
export async function validateCoreSubjects(
  supabase: ReturnType<typeof createClient>,
  schoolId: string
): Promise<{ isValid: boolean; missing: string[] }> {
  try {
    const { data: coreSubjects, error } = await supabase
      .from('subjects')
      .select('code')
      .eq('school_id', schoolId)
      .eq('is_core', true)

    if (error) {
      throw new Error(`Failed to fetch core subjects: ${error.message}`)
    }

    const existingCodes = new Set((coreSubjects as Pick<Subject, 'code'>[])?.map(s => s.code) || [])
    const requiredCodes = CORE_SUBJECTS.map(s => s.code)
    const missing = requiredCodes.filter(code => !existingCodes.has(code))

    return {
      isValid: missing.length === 0,
      missing
    }
  } catch (error) {
    console.error('Error validating core subjects:', error)
    return {
      isValid: false,
      missing: CORE_SUBJECTS.map(s => s.code)
    }
  }
}
