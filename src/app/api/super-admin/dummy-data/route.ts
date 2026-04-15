import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { writeAuditLog } from '@/lib/audit-log'

type Preset = 'full_school_fixture' | 'report_focused'

type GeneratorResult = {
  schoolId: string
  schoolName: string
  createdCounts: {
    users: number
    profiles: number
    classes: number
    subjects: number
    students: number
    teachers: number
    scores: number
  }
}

function gradeFromScore(total: number): string {
  if (total >= 80) return '1'
  if (total >= 70) return '2'
  if (total >= 60) return '3'
  if (total >= 50) return '4'
  if (total >= 40) return '5'
  if (total >= 30) return '6'
  if (total >= 20) return '7'
  if (total >= 10) return '8'
  return '9'
}

async function createAuthUser(admin: ReturnType<typeof createAdminSupabaseClient>, email: string, password: string, fullName: string) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || `Failed to create auth user for ${email}`)
  }

  return created.data.user.id
}

async function ensureCurrentSession(admin: ReturnType<typeof createAdminSupabaseClient>, schoolId: string) {
  const { data: existing } = await (admin as any)
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  if (existing?.id) {
    return existing.id as string
  }

  const sessionId = randomUUID()
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 3)
  const year = now.getFullYear()

  const { error } = await (admin as any)
    .from('academic_sessions')
    .insert({
      id: sessionId,
      school_id: schoolId,
      academic_year: `${year}/${year + 1}`,
      term: '1',
      start_date: now.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      is_current: true,
    })

  if (error) {
    throw new Error(error.message)
  }

  return sessionId
}

async function generatePreset(admin: ReturnType<typeof createAdminSupabaseClient>, preset: Preset, schoolIdInput?: string | null): Promise<GeneratorResult> {
  const stamp = Date.now()
  const counts: GeneratorResult['createdCounts'] = {
    users: 0,
    profiles: 0,
    classes: 0,
    subjects: 0,
    students: 0,
    teachers: 0,
    scores: 0,
  }

  let schoolId = schoolIdInput || ''
  let schoolName = ''

  if (!schoolId) {
    schoolId = randomUUID()
    schoolName = preset === 'full_school_fixture'
      ? `Sandbox Academy ${stamp}`
      : `Reports Sandbox ${stamp}`

    const { error: schoolError } = await (admin as any)
      .from('schools')
      .insert({
        id: schoolId,
        name: schoolName,
        email: `sandbox-${stamp}@smartsba.local`,
        phone: '+0000000000',
        address: 'Generated test campus',
        status: 'active',
      })

    if (schoolError) {
      throw new Error(schoolError.message)
    }
  } else {
    const { data: school } = await (admin as any)
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()

    schoolName = (school?.name as string | undefined) || `Existing School ${schoolId}`
  }

  const sessionId = await ensureCurrentSession(admin, schoolId)

  const classCount = preset === 'full_school_fixture' ? 2 : 1
  const subjectNames = preset === 'full_school_fixture'
    ? ['English', 'Mathematics', 'Integrated Science', 'Social Studies', 'ICT']
    : ['English', 'Mathematics', 'Integrated Science', 'Social Studies', 'Creative Arts', 'Computing']

  const classIds: string[] = []
  for (let i = 1; i <= classCount; i += 1) {
    const classId = randomUUID()
    classIds.push(classId)
    const { error } = await (admin as any)
      .from('classes')
      .insert({
        id: classId,
        school_id: schoolId,
        name: `Generated Class ${i}`,
        stream: i === 1 ? 'A' : 'B',
        level: i,
        description: `Generated ${preset} class`,
      })
    if (error) throw new Error(error.message)
    counts.classes += 1
  }

  const subjectIdsByClass = new Map<string, string[]>()
  for (const classId of classIds) {
    const subjectIds: string[] = []
    for (const subjectName of subjectNames) {
      const subjectId = randomUUID()
      const { error } = await (admin as any)
        .from('subjects')
        .insert({
          id: subjectId,
          school_id: schoolId,
          class_id: classId,
          name: subjectName,
          code: subjectName.slice(0, 3).toUpperCase(),
          is_core: true,
        })
      if (error) throw new Error(error.message)
      subjectIds.push(subjectId)
      counts.subjects += 1
    }
    subjectIdsByClass.set(classId, subjectIds)
  }

  const schoolAdminEmail = `generated-school-admin-${stamp}@smartsba.local`
  const schoolAdminUserId = await createAuthUser(admin, schoolAdminEmail, 'TempPass#1234', `Generated Admin ${stamp}`)
  counts.users += 1

  const schoolAdminProfileId = randomUUID()
  const { error: schoolAdminProfileError } = await (admin as any)
    .from('user_profiles')
    .insert({
      id: schoolAdminProfileId,
      user_id: schoolAdminUserId,
      school_id: schoolId,
      role: 'school_admin',
      email: schoolAdminEmail,
      full_name: `Generated Admin ${stamp}`,
      staff_id: `GEN-ADM-${stamp}`,
      phone: '+0000001000',
      address: 'Generated Admin Block',
    })
  if (schoolAdminProfileError) throw new Error(schoolAdminProfileError.message)
  counts.profiles += 1

  const teacherCount = preset === 'full_school_fixture' ? 4 : 2
  const teacherProfileIds: string[] = []

  for (let i = 1; i <= teacherCount; i += 1) {
    const email = `generated-teacher-${stamp}-${i}@smartsba.local`
    const userId = await createAuthUser(admin, email, 'TempPass#1234', `Generated Teacher ${i}`)
    counts.users += 1

    const profileId = randomUUID()
    teacherProfileIds.push(profileId)

    const { error: profileError } = await (admin as any)
      .from('user_profiles')
      .insert({
        id: profileId,
        user_id: userId,
        school_id: schoolId,
        role: 'teacher',
        email,
        full_name: `Generated Teacher ${i}`,
        staff_id: `GEN-TCH-${stamp}-${i}`,
        phone: `+00000020${i.toString().padStart(2, '0')}`,
      })
    if (profileError) throw new Error(profileError.message)
    counts.profiles += 1

    const { error: teacherError } = await (admin as any)
      .from('teachers')
      .insert({
        id: randomUUID(),
        school_id: schoolId,
        user_id: userId,
        staff_id: `GEN-TCH-${stamp}-${i}`,
        specialization: i % 2 === 0 ? 'Science' : 'Languages',
        qualification: 'B.Ed',
        hire_date: new Date().toISOString().slice(0, 10),
        is_active: true,
      })
    if (teacherError) throw new Error(teacherError.message)
    counts.teachers += 1
  }

  const studentCount = preset === 'full_school_fixture' ? 24 : 12

  for (let i = 1; i <= studentCount; i += 1) {
    const classId = classIds[(i - 1) % classIds.length]
    const subjectIds = subjectIdsByClass.get(classId) || []

    const studentEmail = `generated-student-${stamp}-${i}@smartsba.local`
    const studentUserId = await createAuthUser(admin, studentEmail, 'TempPass#1234', `Generated Student ${i}`)
    counts.users += 1

    const studentProfileId = randomUUID()
    const studentAdmission = `GEN-${stamp}-${i.toString().padStart(3, '0')}`

    const { error: studentProfileError } = await (admin as any)
      .from('user_profiles')
      .insert({
        id: studentProfileId,
        user_id: studentUserId,
        school_id: schoolId,
        role: 'student',
        email: studentEmail,
        full_name: `Generated Student ${i}`,
        admission_number: studentAdmission,
        phone: `+00000030${i.toString().padStart(2, '0')}`,
        gender: i % 2 === 0 ? 'female' : 'male',
      })
    if (studentProfileError) throw new Error(studentProfileError.message)
    counts.profiles += 1

    const studentRowId = randomUUID()
    const { error: studentError } = await (admin as any)
      .from('students')
      .insert({
        id: studentRowId,
        school_id: schoolId,
        user_id: studentUserId,
        admission_number: studentAdmission,
        roll_number: `${i}`,
        class_id: classId,
        date_of_birth: '2012-01-01',
        gender: i % 2 === 0 ? 'female' : 'male',
        guardian_name: `Guardian ${i}`,
        guardian_phone: `+00000040${i.toString().padStart(2, '0')}`,
        guardian_email: `guardian-${stamp}-${i}@smartsba.local`,
        admission_date: new Date().toISOString().slice(0, 10),
        is_active: true,
      })
    if (studentError) throw new Error(studentError.message)
    counts.students += 1

    for (const subjectId of subjectIds) {
      const ca = Math.floor(Math.random() * 30) + 1
      const exam = Math.floor(Math.random() * 70) + 1
      const total = ca + exam

      const { error: scoreError } = await (admin as any)
        .from('scores')
        .insert({
          id: randomUUID(),
          student_id: studentRowId,
          subject_id: subjectId,
          session_id: sessionId,
          ca_score: ca,
          exam_score: exam,
          total_score: total,
          grade: gradeFromScore(total),
          entered_by: teacherProfileIds[0],
        })

      if (scoreError) throw new Error(scoreError.message)
      counts.scores += 1
    }
  }

  return {
    schoolId,
    schoolName,
    createdCounts: counts,
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const { data: actorProfile } = await (admin as any)
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!actorProfile || (actorProfile as { role?: string }).role !== 'super_admin') {
      return NextResponse.json({ error: 'SysAdmin access required' }, { status: 403 })
    }

    const body = (await req.json()) as { preset?: Preset; schoolId?: string | null }
    const preset = body.preset
    if (!preset || !['full_school_fixture', 'report_focused'].includes(preset)) {
      return NextResponse.json({ error: 'Valid preset is required' }, { status: 400 })
    }

    const result = await generatePreset(admin, preset, body.schoolId || null)

    await writeAuditLog(admin as any, {
      actorUserId: user.id,
      actorRole: 'super_admin',
      actionType: 'dummy_data_generated',
      entityType: 'school',
      entityId: result.schoolId,
      metadata: {
        preset,
        school_name: result.schoolName,
        created_counts: result.createdCounts,
      },
    })

    return NextResponse.json({ success: true, result })
  } catch (routeError) {
    console.error('Dummy data generation failed:', routeError)
    return NextResponse.json({ error: routeError instanceof Error ? routeError.message : 'Generation failed' }, { status: 500 })
  }
}
