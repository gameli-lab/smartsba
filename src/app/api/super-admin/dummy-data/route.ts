/**import { randomUUID } from 'crypto'
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
    ? ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'ICT']
    : ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'Creative Arts', 'Computing']

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
          // total_score: total,
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
**/


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
    attendance: number
    remarks: number
    assignments: number
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function remarkFromAggregate(agg: number): string {
  if (agg <= 12) return 'Excellent performance. Keep up the outstanding work!'
  if (agg <= 18) return 'Very good performance. Continue working hard.'
  if (agg <= 24) return 'Good performance. There is room for improvement.'
  if (agg <= 30) return 'Satisfactory performance. More effort is needed.'
  return 'Below average performance. Needs to work harder and seek help.'
}

function promotionStatusFromAggregate(agg: number): string {
  if (agg === 0) return 'pending'
  if (agg <= 36) return 'promoted'
  return 'repeated'
}

// Realistic Ghanaian student names
const FIRST_NAMES_M = ['Kwame', 'Kofi', 'Kweku', 'Yaw', 'Kwabena', 'Fiifi', 'Nana', 'Ebo', 'Kojo', 'Kwasi', 'Adjei', 'Mensah']
const FIRST_NAMES_F = ['Ama', 'Abena', 'Akua', 'Yaa', 'Efua', 'Afia', 'Adwoa', 'Akosua', 'Mamle', 'Esi', 'Araba', 'Maame']
const LAST_NAMES   = ['Mensah', 'Asante', 'Boateng', 'Osei', 'Appiah', 'Darko', 'Agyei', 'Frimpong', 'Owusu', 'Amoah', 'Quaye', 'Tetteh', 'Ofori', 'Adusei', 'Acheampong']

function randomName(gender: 'male' | 'female'): string {
  const first = gender === 'male'
    ? FIRST_NAMES_M[Math.floor(Math.random() * FIRST_NAMES_M.length)]
    : FIRST_NAMES_F[Math.floor(Math.random() * FIRST_NAMES_F.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `${first} ${last}`
}

// Weighted score generator — produces realistic bell-curve distribution
function realisticScore(min: number, max: number): number {
  // Average of two randoms gives rough bell curve
  const a = Math.random()
  const b = Math.random()
  return Math.round(min + (a + b) / 2 * (max - min))
}

async function createAuthUser(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  email: string,
  password: string,
  fullName: string,
) {
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

async function ensureCompletedSession(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  schoolId: string,
) {
  // Check for existing completed session first
  const { data: existing } = await (admin as any)
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const sessionId = randomUUID()
  const now = new Date()

  // Term dates: started ~4 months ago, ended last month — a completed term
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - 4)

  const endDate = new Date(now)
  endDate.setMonth(endDate.getMonth() - 1)

  const vacationDate = new Date(endDate)
  vacationDate.setDate(vacationDate.getDate() + 3)

  const reopeningDate = new Date(now)
  reopeningDate.setMonth(reopeningDate.getMonth() + 2)

  const year = startDate.getFullYear()

  const { error } = await (admin as any)
    .from('academic_sessions')
    .insert({
      id: sessionId,
      school_id: schoolId,
      academic_year: `${year}/${year + 1}`,
      term: '1',
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      vacation_date: vacationDate.toISOString().slice(0, 10),
      reopening_date: reopeningDate.toISOString().slice(0, 10),
      is_current: true,
    })

  if (error) throw new Error(error.message)
  return sessionId
}

// ─── Main generator ──────────────────────────────────────────────────────────

async function generatePreset(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  preset: Preset,
  schoolIdInput?: string | null,
): Promise<GeneratorResult> {
  const stamp = Date.now()
  const counts: GeneratorResult['createdCounts'] = {
    users: 0, profiles: 0, classes: 0, subjects: 0,
    students: 0, teachers: 0, scores: 0, attendance: 0,
    remarks: 0, assignments: 0,
  }

  // ── School ──────────────────────────────────────────────────────────────────
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
        motto: 'Excellence Through Effort',
        email: `sandbox-${stamp}@smartsba.local`,
        phone: '+233000000000',
        address: 'Generated Test Campus, Accra, Ghana',
      })
    if (schoolError) throw new Error(schoolError.message)
  } else {
    const { data: school } = await (admin as any)
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()
    schoolName = (school?.name as string | undefined) || `Existing School ${schoolId}`
  }

  // ── Session (completed term) ─────────────────────────────────────────────
  const sessionId = await ensureCompletedSession(admin, schoolId)
  const academicYear = new Date().getFullYear()

  // ── Subjects config ──────────────────────────────────────────────────────
  // IMPORTANT: 'English Language' must match exactly what calculate_student_aggregate expects
  const coreSubjects = [
    { name: 'English Language', code: 'ENG', is_core: true },
    { name: 'Mathematics',      code: 'MAT', is_core: true },
    { name: 'Integrated Science', code: 'SCI', is_core: true },
    { name: 'Social Studies',   code: 'SOC', is_core: true },
  ]
  const electiveSubjects = preset === 'full_school_fixture'
    ? [
        { name: 'ICT',            code: 'ICT', is_core: false },
        { name: 'Creative Arts',  code: 'CRE', is_core: false },
        { name: 'French',         code: 'FRE', is_core: false },
      ]
    : [
        { name: 'ICT',            code: 'ICT', is_core: false },
        { name: 'Computing',      code: 'COM', is_core: false },
      ]
  const allSubjectDefs = [...coreSubjects, ...electiveSubjects]

  // ── Classes ──────────────────────────────────────────────────────────────
  const classCount = preset === 'full_school_fixture' ? 3 : 1
  const classConfigs = [
    { name: 'JHS 1', stream: 'A', level: 7 },
    { name: 'JHS 2', stream: 'A', level: 8 },
    { name: 'JHS 3', stream: 'A', level: 9 },
  ].slice(0, classCount)

  const classIds: string[] = []

  for (const cfg of classConfigs) {
    const classId = randomUUID()
    classIds.push(classId)
    const { error } = await (admin as any)
      .from('classes')
      .insert({
        id: classId,
        school_id: schoolId,
        name: cfg.name,
        stream: cfg.stream,
        level: cfg.level,
        description: `${cfg.name} ${cfg.stream} — Generated ${preset}`,
      })
    if (error) throw new Error(error.message)
    counts.classes += 1
  }

  // ── Subjects per class ───────────────────────────────────────────────────
  const subjectIdsByClass = new Map<string, string[]>()

  for (const classId of classIds) {
    const subjectIds: string[] = []
    for (const sub of allSubjectDefs) {
      const subjectId = randomUUID()
      const { error } = await (admin as any)
        .from('subjects')
        .insert({
          id: subjectId,
          school_id: schoolId,
          class_id: classId,
          name: sub.name,
          code: sub.code,
          is_core: sub.is_core,
        })
      if (error) throw new Error(error.message)
      subjectIds.push(subjectId)
      counts.subjects += 1
    }
    subjectIdsByClass.set(classId, subjectIds)
  }

  // ── School admin ─────────────────────────────────────────────────────────
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
      phone: '+233001000000',
      address: 'Admin Block',
    })
  if (schoolAdminProfileError) throw new Error(schoolAdminProfileError.message)
  counts.profiles += 1

  // ── Teachers ─────────────────────────────────────────────────────────────
  const teacherCount = preset === 'full_school_fixture' ? 4 : 2
  const teacherProfileIds: string[] = []
  const teacherRowIds: string[] = []

  for (let i = 1; i <= teacherCount; i++) {
    const gender = i % 2 === 0 ? 'female' : 'male'
    const fullName = `${randomName(gender)} (Teacher)`
    const email = `generated-teacher-${stamp}-${i}@smartsba.local`
    const userId = await createAuthUser(admin, email, 'TempPass#1234', fullName)
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
        full_name: fullName,
        staff_id: `GEN-TCH-${stamp}-${i}`,
        phone: `+2330020${i.toString().padStart(4, '0')}`,
        gender,
      })
    if (profileError) throw new Error(profileError.message)
    counts.profiles += 1

    const teacherRowId = randomUUID()
    teacherRowIds.push(teacherRowId)

    const { error: teacherError } = await (admin as any)
      .from('teachers')
      .insert({
        id: teacherRowId,
        school_id: schoolId,
        user_id: userId,
        staff_id: `GEN-TCH-${stamp}-${i}`,
        specialization: i % 2 === 0 ? 'Sciences' : 'Languages & Humanities',
        qualification: 'B.Ed (Basic Education)',
        hire_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        is_active: true,
      })
    if (teacherError) throw new Error(teacherError.message)
    counts.teachers += 1
  }

  // ── Teacher assignments ───────────────────────────────────────────────────
  // Assign each teacher to classes and subjects
  for (let ci = 0; ci < classIds.length; ci++) {
    const classId = classIds[ci]
    const subjectIds = subjectIdsByClass.get(classId) || []
    const academicYearStr = `${academicYear}/${academicYear + 1}`
    let isClassTeacherSet = false

    for (let si = 0; si < subjectIds.length; si++) {
      const teacherId = teacherRowIds[si % teacherRowIds.length]
      const isClassTeacher = !isClassTeacherSet && si === 0
      if (isClassTeacher) isClassTeacherSet = true

      const { error: assignError } = await (admin as any)
        .from('teacher_assignments')
        .insert({
          id: randomUUID(),
          teacher_id: teacherId,
          class_id: classId,
          subject_id: subjectIds[si],
          is_class_teacher: isClassTeacher,
          academic_year: academicYearStr,
        })
      // Ignore duplicate conflicts silently
      if (assignError && !assignError.message.includes('unique')) {
        throw new Error(assignError.message)
      }
      counts.assignments += 1
    }

    // Set class_teacher_id on the class record
    await (admin as any)
      .from('classes')
      .update({ class_teacher_id: teacherRowIds[ci % teacherRowIds.length] })
      .eq('id', classId)
  }

  // ── Students, scores, attendance, remarks ─────────────────────────────────
  const studentCount = preset === 'full_school_fixture' ? 30 : 15

  // We'll collect aggregates per class to compute positions after all students inserted
  // structure: classId -> [{ studentRowId, aggregate }]
  const classAggregates = new Map<string, { studentRowId: string; aggregate: number }[]>()
  for (const cid of classIds) classAggregates.set(cid, [])

  const allStudentAggregates: { studentRowId: string; aggregate: number }[] = []

  for (let i = 1; i <= studentCount; i++) {
    const classId = classIds[(i - 1) % classIds.length]
    const subjectIds = subjectIdsByClass.get(classId) || []
    const gender: 'male' | 'female' = i % 2 === 0 ? 'female' : 'male'
    const fullName = randomName(gender)
    const studentEmail = `generated-student-${stamp}-${i}@smartsba.local`
    const studentUserId = await createAuthUser(admin, studentEmail, 'TempPass#1234', fullName)
    counts.users += 1

    const studentProfileId = randomUUID()
    const studentAdmission = `GEN-${stamp}-${i.toString().padStart(3, '0')}`
    const dob = new Date(2010 - Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)

    const { error: studentProfileError } = await (admin as any)
      .from('user_profiles')
      .insert({
        id: studentProfileId,
        user_id: studentUserId,
        school_id: schoolId,
        role: 'student',
        email: studentEmail,
        full_name: fullName,
        admission_number: studentAdmission,
        phone: `+2330030${i.toString().padStart(4, '0')}`,
        gender,
        date_of_birth: dob.toISOString().slice(0, 10),
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
        date_of_birth: dob.toISOString().slice(0, 10),
        gender,
        guardian_name: `${LAST_NAMES[i % LAST_NAMES.length]} (Guardian)`,
        guardian_phone: `+2330040${i.toString().padStart(4, '0')}`,
        guardian_email: `guardian-${stamp}-${i}@smartsba.local`,
        admission_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        is_active: true,
      })
    if (studentError) throw new Error(studentError.message)
    counts.students += 1

    // ── Scores ──────────────────────────────────────────────────────────────
    let coreAggregate = 0
    let electiveGrades: number[] = []
    let coreCount = 0

    for (let si = 0; si < subjectIds.length; si++) {
      const subjectId = subjectIds[si]
      const subDef = allSubjectDefs[si]

      // Core subjects: slightly higher scores to ensure aggregate passes
      const ca   = subDef.is_core ? realisticScore(15, 30) : realisticScore(8, 30)
      const exam = subDef.is_core ? realisticScore(35, 70) : realisticScore(20, 70)
      const total = ca + exam
      const grade = gradeFromScore(total)
      const gradeNum = parseInt(grade)

      const { error: scoreError } = await (admin as any)
        .from('scores')
        .insert({
          id: randomUUID(),
          student_id: studentRowId,
          subject_id: subjectId,
          session_id: sessionId,
          ca_score: ca,
          exam_score: exam,
          // total_score omitted — DB generates it
          grade,
          subject_remark: total >= 70 ? 'Excellent' : total >= 50 ? 'Good' : total >= 40 ? 'Average' : 'Needs Improvement',
          entered_by: teacherProfileIds[si % teacherProfileIds.length],
        })
      if (scoreError) throw new Error(scoreError.message)
      counts.scores += 1

      if (subDef.is_core) {
        coreAggregate += gradeNum
        coreCount++
      } else {
        electiveGrades.push(gradeNum)
      }
    }

    // Compute aggregate locally (mirrors DB function logic)
    // Only count if all 4 core subjects present
    let totalAggregate = 0
    if (coreCount >= 4) {
      electiveGrades.sort((a, b) => a - b) // ascending = best grades first
      const bestElectives = electiveGrades.slice(0, 4)
      totalAggregate = coreAggregate + bestElectives.reduce((s, g) => s + g, 0)
    }

    allStudentAggregates.push({ studentRowId, aggregate: totalAggregate })
    classAggregates.get(classId)!.push({ studentRowId, aggregate: totalAggregate })

    // ── Attendance ───────────────────────────────────────────────────────────
    const totalDays = 65 // typical Ghanaian term
    const presentDays = Math.min(totalDays, Math.max(40, realisticScore(50, 65)))

    const { error: attError } = await (admin as any)
      .from('attendance')
      .insert({
        id: randomUUID(),
        student_id: studentRowId,
        session_id: sessionId,
        present_days: presentDays,
        total_days: totalDays,
        entered_by: teacherProfileIds[0],
      })
    if (attError) throw new Error(attError.message)
    counts.attendance += 1

    // ── Class teacher remark ─────────────────────────────────────────────────
    const remark = remarkFromAggregate(totalAggregate)
    const promotionStatus = promotionStatusFromAggregate(totalAggregate)

    // Determine next class (promoted students move up)
    const currentClassIndex = classIds.indexOf(classId)
    const nextClassId = promotionStatus === 'promoted' && currentClassIndex < classIds.length - 1
      ? classIds[currentClassIndex + 1]
      : classId

    const { error: remarkError } = await (admin as any)
      .from('class_teacher_remarks')
      .insert({
        id: randomUUID(),
        student_id: studentRowId,
        session_id: sessionId,
        remark,
        promotion_status: promotionStatus,
        next_class_id: nextClassId,
        entered_by: teacherProfileIds[currentClassIndex % teacherProfileIds.length],
      })
    if (remarkError) throw new Error(remarkError.message)
    counts.remarks += 1
  }

  // ── Positions — computed after all students inserted ──────────────────────
  // Class positions
  for (const [classId, entries] of classAggregates.entries()) {
    const sorted = [...entries].sort((a, b) => a.aggregate - b.aggregate) // lower agg = better rank
    for (let rank = 0; rank < sorted.length; rank++) {
      const { studentRowId, aggregate } = sorted[rank]
      if (aggregate === 0) continue // skip incomplete aggregates
      await (admin as any)
        .from('student_aggregates')
        .update({
          class_position: rank + 1,
          class_id: classId,
        })
        .eq('student_id', studentRowId)
        .eq('session_id', sessionId)
    }
  }

  // Overall positions across all classes in school
  const allSorted = [...allStudentAggregates]
    .filter(e => e.aggregate > 0)
    .sort((a, b) => a.aggregate - b.aggregate)

  for (let rank = 0; rank < allSorted.length; rank++) {
    await (admin as any)
      .from('student_aggregates')
      .update({ overall_position: rank + 1 })
      .eq('student_id', allSorted[rank].studentRowId)
      .eq('session_id', sessionId)
  }

  return { schoolId, schoolName, createdCounts: counts }
}

// ─── Route handler ───────────────────────────────────────────────────────────

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
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Generation failed' },
      { status: 500 },
    )
  }
}