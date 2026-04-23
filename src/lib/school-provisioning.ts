import { createAdminSupabaseClient } from '@/lib/supabase'

export type EducationLevel = 'KG' | 'PRIMARY' | 'JHS' | 'SHS' | 'SHTS'
export type StreamType = 'single' | 'double' | 'cluster'

export type ProvisionSchoolResult = {
  generatedClasses: number
  seededSubjectSettings: number
  seededClassSubjects: number
}

function levelGroupFromClassLevel(level: number): 'KG' | 'PRIMARY' | 'JHS' | 'UNKNOWN' {
  if (level === -1 || level === 0) return 'KG'
  if (level >= 1 && level <= 6) return 'PRIMARY'
  if (level >= 7 && level <= 9) return 'JHS'
  return 'UNKNOWN'
}

function canAssignToClass(classLevel: number, subjectName: string): boolean {
  if (subjectName.trim().toLowerCase() !== 'science') return true
  return classLevel >= 4 && classLevel <= 6
}

export async function provisionSchoolAcademicStructure(schoolId: string): Promise<ProvisionSchoolResult> {
  const admin = createAdminSupabaseClient()

  const [{ data: classData, error: classError }, { data: settingsData, error: settingsError }, { data: classSubjectsData, error: classSubjectsError }] = await Promise.all([
    admin.rpc('generate_school_classes', { p_school_id: schoolId }),
    admin.rpc('seed_school_subject_settings', { p_school_id: schoolId }),
    admin.rpc('seed_class_subjects_from_settings', { p_school_id: schoolId }),
  ])

  if (classError) throw classError
  if (settingsError) throw settingsError
  if (classSubjectsError) throw classSubjectsError

  const generatedClasses = Number((classData as Array<{ created_count: number }> | null)?.[0]?.created_count ?? 0)
  const seededSubjectSettings = Number((settingsData as Array<{ created_count: number }> | null)?.[0]?.created_count ?? 0)
  const seededClassSubjects = Number((classSubjectsData as Array<{ created_count: number }> | null)?.[0]?.created_count ?? 0)

  return {
    generatedClasses,
    seededSubjectSettings,
    seededClassSubjects,
  }
}

export async function syncSubjectToggleForSchool(options: {
  schoolId: string
  levelGroup: 'KG' | 'PRIMARY' | 'JHS' | 'SHS' | 'SHTS'
  subjectName: string
  isEnabled: boolean
}) {
  const admin = createAdminSupabaseClient()
  const { schoolId, levelGroup, subjectName, isEnabled } = options

  if (!isEnabled) {
    const { data: subjectRows } = await admin
      .from('subjects')
      .select('id')
      .eq('school_id', schoolId)
      .eq('level_group', levelGroup)
      .ilike('name', subjectName)

    const subjectIds = (subjectRows || []).map((row) => row.id)

    if (subjectIds.length > 0) {
      await admin
        .from('class_subjects')
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq('school_id', schoolId)
        .in('subject_id', subjectIds)
        .eq('source', 'default')
    }

    return
  }

  const { data: subjectRow, error: subjectError } = await admin
    .from('subjects')
    .select('id, school_id, level_group, name, is_core, is_active')
    .eq('school_id', schoolId)
    .eq('level_group', levelGroup)
    .ilike('name', subjectName)
    .maybeSingle()

  if (subjectError) throw subjectError

  let subjectId = subjectRow?.id

  if (!subjectId) {
    const { data: inserted, error: insertError } = await admin
      .from('subjects')
      .insert({
        school_id: schoolId,
        level_group: levelGroup,
        name: subjectName,
        is_core: false,
        is_active: true,
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    subjectId = inserted.id
  } else if (subjectRow?.is_active === false) {
    await admin
      .from('subjects')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', subjectId)
  }

  const { data: classesData, error: classesError } = await admin
    .from('classes')
    .select('id, level')
    .eq('school_id', schoolId)

  if (classesError) throw classesError

  const targetClasses = (classesData || []).filter((klass) => {
    const classLevelGroup = levelGroupFromClassLevel(klass.level)
    return classLevelGroup === levelGroup && canAssignToClass(klass.level, subjectName)
  })

  if (!targetClasses.length || !subjectId) return

  const payload = targetClasses.map((klass) => ({
    class_id: klass.id,
    school_id: schoolId,
    subject_id: subjectId,
    level_group: levelGroup,
    source: 'default',
    is_enabled: true,
  }))

  const { error: insertClassSubjectError } = await admin
    .from('class_subjects')
    .upsert(payload, { onConflict: 'class_id,subject_id' })

  if (insertClassSubjectError) throw insertClassSubjectError
}

export async function upsertClassSubjectOverride(options: {
  schoolId: string
  classId: string
  subjectId: string
  isEnabled: boolean
}) {
  const admin = createAdminSupabaseClient()
  const { schoolId, classId, subjectId, isEnabled } = options

  const { data: classRow, error: classError } = await admin
    .from('classes')
    .select('id, school_id, level')
    .eq('id', classId)
    .maybeSingle()

  if (classError) throw classError
  if (!classRow || classRow.school_id !== schoolId) {
    throw new Error('Class not found for school')
  }

  const { data: subjectRow, error: subjectError } = await admin
    .from('subjects')
    .select('id, school_id, level_group, name')
    .eq('id', subjectId)
    .maybeSingle()

  if (subjectError) throw subjectError
  if (!subjectRow || subjectRow.school_id !== schoolId) {
    throw new Error('Subject not found for school')
  }

  if (!canAssignToClass(classRow.level, subjectRow.name)) {
    throw new Error('Science can only be assigned to Basic 4-6')
  }

  const inferredLevelGroup = levelGroupFromClassLevel(classRow.level)
  if (inferredLevelGroup !== subjectRow.level_group) {
    throw new Error('Subject level does not match class level group')
  }

  const { error: upsertError } = await admin
    .from('class_subjects')
    .upsert(
      {
        class_id: classId,
        school_id: schoolId,
        subject_id: subjectId,
        level_group: subjectRow.level_group,
        source: 'override',
        is_enabled: isEnabled,
      },
      { onConflict: 'class_id,subject_id' }
    )

  if (upsertError) throw upsertError
}
