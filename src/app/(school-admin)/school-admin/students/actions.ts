'use server'

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { createServerComponentClient, createAdminSupabaseClient } from '@/lib/supabase'
import logAudit, { logAssumptionAwareAudit } from '@/lib/audit'
import type { Student } from '@/types'

interface CreateStudentInput {
  full_name: string
  email: string
  admission_number: string
  class_id: string
  gender: 'male' | 'female'
  date_of_birth: string
  admission_date: string
  roll_number?: string
  phone?: string
  address?: string
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
}

interface UpdateStudentInput extends Partial<CreateStudentInput> {
  id: string
}

interface ImportRow {
  full_name: string
  email?: string
  admission_number: string
  class_name: string
  gender?: 'male' | 'female'
  date_of_birth?: string
  admission_date?: string
  roll_number?: string
  phone?: string
  address?: string
  guardian_name?: string
  guardian_phone?: string
  guardian_email?: string
}

interface ImportFailure {
  row: number
  reason: string
}

interface ImportResult {
  imported: number
  failed: ImportFailure[]
  credentials: Array<{
    row: number
    full_name: string
    email: string
    admission_number: string
    temp_password: string
  }>
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return undefined
    return parsed.toISOString().slice(0, 10)
  }
  return undefined
}

function normalizeGender(value: unknown): 'male' | 'female' | undefined {
  if (!value) return undefined
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'male' || normalized === 'm') return 'male'
  if (normalized === 'female' || normalized === 'f') return 'female'
  return undefined
}

function normalizeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text.length ? text : undefined
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function randomTempPassword(prefix: string) {
  return `${prefix}@${Math.random().toString(36).slice(-8)}`
}

function normalizePhone(value?: string | null) {
  if (!value) return null
  return value.replace(/[^0-9+]/g, '')
}

type ParentResolutionResult =
  | {
      status: 'created_and_linked'
      parentProfileId: string
      parentTempPassword: string
    }
  | {
      status: 'linked_existing_parent'
      parentProfileId: string
    }
  | {
      status: 'skipped_no_guardian_email' | 'skipped_invalid_guardian_email'
    }
  | {
      status: 'conflict_existing_non_parent_email'
      existingRole: string
    }

async function resolveGuardianParentForStudent(params: {
  schoolId: string
  studentId: string
  guardianName?: string
  guardianEmail?: string
  guardianPhone?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any
}): Promise<ParentResolutionResult> {
  const guardianEmail = params.guardianEmail?.trim().toLowerCase()
  if (!guardianEmail) return { status: 'skipped_no_guardian_email' }
  if (!validateEmail(guardianEmail)) return { status: 'skipped_invalid_guardian_email' }

  const guardianPhone = normalizePhone(params.guardianPhone)
  const guardianName = params.guardianName?.trim() || 'Parent Guardian'

  const { data: existingProfile } = await params.supabase
    .from('user_profiles')
    .select('id, user_id, role, full_name, phone')
    .eq('email', guardianEmail)
    .maybeSingle()

  if (existingProfile) {
    if (existingProfile.role !== 'parent') {
      return {
        status: 'conflict_existing_non_parent_email',
        existingRole: existingProfile.role,
      }
    }

    const parentProfileId = existingProfile.id as string

    const { data: existingLink } = await params.supabase
      .from('parent_student_links')
      .select('id')
      .eq('parent_id', parentProfileId)
      .eq('student_id', params.studentId)
      .maybeSingle()

    if (!existingLink) {
      await params.adminSupabase
        .from('parent_student_links')
        .insert({
          parent_id: parentProfileId,
          student_id: params.studentId,
          relationship: 'Guardian',
          is_primary: true,
        })
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    let shouldUpdate = false

    if ((!existingProfile.full_name || existingProfile.full_name === 'Parent Guardian') && guardianName) {
      updatePayload.full_name = guardianName
      shouldUpdate = true
    }

    if (!existingProfile.phone && guardianPhone) {
      updatePayload.phone = guardianPhone
      shouldUpdate = true
    }

    if (shouldUpdate) {
      await params.adminSupabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', parentProfileId)
        .eq('role', 'parent')
    }

    await params.adminSupabase
      .from('parents')
      .upsert(
        {
          user_id: existingProfile.user_id,
          contact_phone: guardianPhone,
        },
        { onConflict: 'user_id' }
      )

    return { status: 'linked_existing_parent', parentProfileId }
  }

  const parentTempPassword = randomTempPassword('Parent')
  const { data: parentAuthUser, error: parentAuthError } = await params.adminSupabase.auth.admin.createUser({
    email: guardianEmail,
    password: parentTempPassword,
    email_confirm: true,
  })

  if (parentAuthError || !parentAuthUser.user) {
    return { status: 'skipped_invalid_guardian_email' }
  }

  const parentUserId = parentAuthUser.user.id

  const { data: parentProfileData, error: parentProfileError } = await params.adminSupabase
    .from('user_profiles')
    .insert({
      user_id: parentUserId,
      school_id: params.schoolId,
      role: 'parent',
      email: guardianEmail,
      full_name: guardianName,
      status: 'active',
      phone: guardianPhone,
    })
    .select('id')
    .single()

  if (parentProfileError || !parentProfileData?.id) {
    await params.adminSupabase.auth.admin.deleteUser(parentUserId)
    return { status: 'skipped_invalid_guardian_email' }
  }

  await params.adminSupabase
    .from('parents')
    .upsert(
      {
        user_id: parentUserId,
        contact_phone: guardianPhone,
      },
      { onConflict: 'user_id' }
    )

  await params.adminSupabase
    .from('parent_student_links')
    .insert({
      parent_id: parentProfileData.id,
      student_id: params.studentId,
      relationship: 'Guardian',
      is_primary: true,
    })

  return {
    status: 'created_and_linked',
    parentProfileId: parentProfileData.id as string,
    parentTempPassword,
  }
}

async function buildTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Students')

  sheet.columns = [
    { header: 'Full Name*', key: 'full_name', width: 25 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Admission Number*', key: 'admission_number', width: 22 },
    { header: 'Class Name*', key: 'class_name', width: 20 },
    { header: 'Gender (Male/Female)*', key: 'gender', width: 20 },
    { header: 'Date of Birth (YYYY-MM-DD)*', key: 'date_of_birth', width: 26 },
    { header: 'Admission Date (YYYY-MM-DD)*', key: 'admission_date', width: 28 },
    { header: 'Roll Number', key: 'roll_number', width: 15 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Address', key: 'address', width: 28 },
    { header: 'Guardian Name', key: 'guardian_name', width: 24 },
    { header: 'Guardian Phone', key: 'guardian_phone', width: 20 },
    { header: 'Guardian Email', key: 'guardian_email', width: 24 },
  ]

  sheet.addRow({
    full_name: 'Ama Mensah',
    email: 'ama.mensah@example.com',
    admission_number: 'ADM-001',
    class_name: 'JHS 1A',
    gender: 'Female',
    date_of_birth: '2012-03-14',
    admission_date: '2024-09-01',
    roll_number: '01',
    phone: '+233201234567',
    address: 'Accra, Ghana',
    guardian_name: 'Kofi Mensah',
    guardian_phone: '+233201111111',
    guardian_email: 'kofi.mensah@example.com',
  })

  sheet.addRow({
    full_name: 'Kwame Owusu',
    email: '',
    admission_number: 'ADM-002',
    class_name: 'JHS 1B',
    gender: 'Male',
    date_of_birth: '2012-05-20',
    admission_date: '2024-09-01',
    roll_number: '02',
    phone: '+233209876543',
    address: 'Kumasi, Ghana',
    guardian_name: 'Akosua Owusu',
    guardian_phone: '+233209111111',
    guardian_email: 'akosua@example.com',
  })

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

  return workbook
}

export async function getStudentsTemplate() {
  const workbook = await buildTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { success: true, filename: 'students_template.xlsx', base64 }
}

export async function createStudent(input: CreateStudentInput) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    if (!input.full_name || !input.email || !input.admission_number || !input.class_id || !input.gender || !input.date_of_birth || !input.admission_date) {
      return { success: false, error: 'All required fields must be provided' }
    }

    if (!validateEmail(input.email)) {
      return { success: false, error: 'Invalid email format' }
    }

    // Check duplicate admission number in school
    const { data: existingAdmission } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('admission_number', input.admission_number)
      .maybeSingle()

    if (existingAdmission) {
      return { success: false, error: `Admission number ${input.admission_number} already exists in your school` }
    }

    // Check duplicate email
    const { data: existingEmail } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', input.email)
      .maybeSingle()

    if (existingEmail) {
      return { success: false, error: 'Email address already exists' }
    }

    // Verify class belongs to school
    const { data: klass } = await supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', input.class_id)
      .single()

    const classRow = klass as { id: string; school_id: string } | null
    if (!classRow || classRow.school_id !== schoolId) {
      return { success: false, error: 'Class not found' }
    }

    const tempPassword = randomTempPassword('Student')

    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      console.error('Error creating auth user:', authError)
      return { success: false, error: 'Failed to create student account' }
    }

    const userId = authUser.user.id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (adminSupabase as any)
      .from('user_profiles')
      .insert({
        user_id: userId,
        school_id: schoolId,
        role: 'student',
        email: input.email,
        full_name: input.full_name,
        status: 'active',
        admission_number: input.admission_number,
        phone: input.phone || null,
        address: input.address || null,
        gender: input.gender,
        date_of_birth: input.date_of_birth,
      })

    if (profileError) {
      console.error('Rollback: deleting auth user after profile error', profileError)
      await adminSupabase.auth.admin.deleteUser(userId)
      return { success: false, error: 'Failed to create student profile' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedStudent, error: studentError } = await (adminSupabase as any)
      .from('students')
      .insert({
        user_id: userId,
        school_id: schoolId,
        admission_number: input.admission_number,
        roll_number: input.roll_number || null,
        class_id: input.class_id,
        date_of_birth: input.date_of_birth,
        gender: input.gender,
        guardian_name: input.guardian_name || null,
        guardian_phone: input.guardian_phone || null,
        guardian_email: input.guardian_email || null,
        address: input.address || null,
        admission_date: input.admission_date,
        is_active: true,
      })
      .select('id, user_id, school_id, admission_number')
      .single()

    if (studentError) {
      console.error('Rollback: deleting auth user after student error', studentError)
      await adminSupabase.auth.admin.deleteUser(userId)
      return { success: false, error: 'Failed to create student record' }
    }

    if (!insertedStudent || insertedStudent.user_id !== userId || insertedStudent.school_id !== schoolId) {
      console.error('Student insert verification failed, rolling back user', {
        expectedUserId: userId,
        expectedSchoolId: schoolId,
        insertedStudent,
      })
      await adminSupabase.auth.admin.deleteUser(userId)
      return { success: false, error: 'Student record was not persisted. Please try again.' }
    }

    // Revalidate after successful creation, but catch any errors to avoid breaking the response
    try {
      revalidatePath('/school-admin/students')
      revalidatePath('/school-admin')
    } catch (revalidateError) {
      console.warn('Warning: revalidatePath failed (this may be expected):', revalidateError)
    }

    const parentResolution = await resolveGuardianParentForStudent({
      schoolId,
      studentId: insertedStudent.id,
      guardianName: input.guardian_name,
      guardianEmail: input.guardian_email,
      guardianPhone: input.guardian_phone,
      supabase,
      adminSupabase,
    })

    const parentAuditActionByStatus: Record<ParentResolutionResult['status'], string> = {
      created_and_linked: 'student_create_auto_parent_created',
      linked_existing_parent: 'student_create_auto_parent_linked',
      skipped_no_guardian_email: 'student_create_parent_resolution_skipped_no_email',
      skipped_invalid_guardian_email: 'student_create_parent_resolution_skipped_invalid_email',
      conflict_existing_non_parent_email: 'student_create_parent_resolution_conflict_non_parent_email',
    }

    await logAudit(adminSupabase, user.id, parentAuditActionByStatus[parentResolution.status], 'student', insertedStudent.id, {
      schoolId,
      admissionNumber: insertedStudent.admission_number,
      guardianEmail: input.guardian_email || null,
      parentResolution,
    })

    await logAssumptionAwareAudit(adminSupabase, user.id, 'student_created', 'student', insertedStudent.id, {
      schoolId,
      admissionNumber: insertedStudent.admission_number,
      createdBy: 'school_admin',
    })

    return {
      success: true,
      tempPassword,
      studentId: insertedStudent.id,
      parentResolution,
      parentTempPassword: parentResolution.status === 'created_and_linked' ? parentResolution.parentTempPassword : null,
    }
  } catch (error) {
    console.error('Error in createStudent:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateStudent(input: UpdateStudentInput) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    if (!input.id) return { success: false, error: 'Student ID is required' }

    // Fetch student for ownership and user_id
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id, user_id, admission_number')
      .eq('id', input.id)
      .single()

    const student = studentRow as Pick<Student, 'id' | 'school_id' | 'user_id' | 'admission_number'> | null
    if (!student || student.school_id !== schoolId) return { success: false, error: 'Student not found' }

    // If class changes, verify class belongs to school
    if (input.class_id) {
      const { data: klass } = await supabase
        .from('classes')
        .select('id, school_id')
        .eq('id', input.class_id)
        .single()

      const classRow = klass as { id: string; school_id: string } | null
      if (!classRow || classRow.school_id !== schoolId) {
        return { success: false, error: 'Class not found' }
      }
    }

    // Update profile
    if (input.full_name || input.phone || input.address || input.gender || input.date_of_birth) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from('user_profiles')
        .update({
          ...(input.full_name && { full_name: input.full_name }),
          ...(input.phone !== undefined && { phone: input.phone || null }),
          ...(input.address !== undefined && { address: input.address || null }),
          ...(input.gender && { gender: input.gender }),
          ...(input.date_of_birth && { date_of_birth: input.date_of_birth }),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', student.user_id)

      if (profileError) {
        console.error('Error updating student profile:', profileError)
        return { success: false, error: 'Failed to update profile' }
      }
    }

    // Update student table
    if (
      input.class_id !== undefined ||
      input.roll_number !== undefined ||
      input.guardian_name !== undefined ||
      input.guardian_phone !== undefined ||
      input.guardian_email !== undefined ||
      input.address !== undefined ||
      input.admission_date !== undefined
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: studentError } = await (supabase as any)
        .from('students')
        .update({
          ...(input.class_id !== undefined && { class_id: input.class_id }),
          ...(input.roll_number !== undefined && { roll_number: input.roll_number || null }),
          ...(input.guardian_name !== undefined && { guardian_name: input.guardian_name || null }),
          ...(input.guardian_phone !== undefined && { guardian_phone: input.guardian_phone || null }),
          ...(input.guardian_email !== undefined && { guardian_email: input.guardian_email || null }),
          ...(input.address !== undefined && { address: input.address || null }),
          ...(input.admission_date !== undefined && { admission_date: input.admission_date }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)

      if (studentError) {
        console.error('Error updating student record:', studentError)
        return { success: false, error: 'Failed to update student' }
      }
    }

    revalidatePath('/school-admin/students')

    await logAssumptionAwareAudit(adminSupabase, user.id, 'student_updated', 'student', student.id, {
      schoolId,
      admissionNumber: student.admission_number,
      updatedFields: Object.keys(input).filter((key) => key !== 'id' && (input as unknown as Record<string, unknown>)[key] !== undefined),
    })

    return { success: true }
  } catch (error) {
    console.error('Error in updateStudent:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function toggleStudentStatus(studentId: string, isActive: boolean) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const adminSupabase = createAdminSupabaseClient()

    const { data: studentRow } = await adminSupabase
      .from('students')
      .select('id, school_id, user_id, admission_number')
      .eq('id', studentId)
      .single()

    const student = studentRow as Pick<Student, 'id' | 'school_id' | 'user_id' | 'admission_number'> | null
    if (!student || student.school_id !== schoolId) return { success: false, error: 'Student not found' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: studentError } = await (adminSupabase as any)
      .from('students')
      .update({ is_active: isActive })
      .eq('id', studentId)

    if (studentError) {
      console.error('Error updating student status:', studentError)
      return { success: false, error: 'Failed to update student status' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (adminSupabase as any)
      .from('user_profiles')
      .update({ status: isActive ? 'active' : 'disabled' })
      .eq('user_id', student.user_id)

    if (profileError) {
      console.error('Error updating profile status:', profileError)
      return { success: false, error: 'Failed to update profile status' }
    }

    revalidatePath('/school-admin/students')

    await logAssumptionAwareAudit(adminSupabase, user.id, 'student_status_changed', 'student', student.id, {
      schoolId,
      admissionNumber: student.admission_number,
      status: isActive ? 'active' : 'disabled',
    })

    return { success: true }
  } catch (error) {
    console.error('Error in toggleStudentStatus:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteStudent(studentId: string) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const adminSupabase = createAdminSupabaseClient()

    const { data: studentRow } = await adminSupabase
      .from('students')
      .select('id, school_id, user_id, admission_number')
      .eq('id', studentId)
      .single()

    const student = studentRow as Pick<Student, 'id' | 'school_id' | 'user_id' | 'admission_number'> | null

    if (!student || student.school_id !== schoolId) {
      return { success: false, error: 'Student not found' }
    }

    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(student.user_id)

    if (deleteError) {
      console.error('Error deleting student auth user:', deleteError)
      return { success: false, error: deleteError.message || 'Failed to delete student' }
    }

    try {
      revalidatePath('/school-admin/students')
      revalidatePath('/school-admin/parents')
      revalidatePath('/school-admin/grading-promotion')
      revalidatePath('/school-admin/reports')
      revalidatePath('/school-admin')
    } catch (revalidateError) {
      console.warn('Warning: revalidatePath failed:', revalidateError)
    }

    await logAssumptionAwareAudit(adminSupabase, user.id, 'student_deleted', 'student', student.id, {
      schoolId,
      admissionNumber: student.admission_number,
    })

    return { success: true, message: 'Student deleted successfully' }
  } catch (error) {
    console.error('Error in deleteStudent:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function importStudents(formData: FormData): Promise<{ success: boolean; result?: ImportResult; error?: string }> {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const adminSupabase = createAdminSupabaseClient()

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'Please select an Excel file to import' }
    if (file.size > 5 * 1024 * 1024) return { success: false, error: 'File size exceeds 5MB limit' }
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) return { success: false, error: 'Only Excel .xlsx files are supported' }

    const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer())) as any
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    const sheet = workbook.worksheets[0]
    if (!sheet) return { success: false, error: 'Excel file is empty or invalid' }

    // Fetch classes for name mapping
    const { data: classRows } = await adminSupabase
      .from('classes')
      .select('id, name, school_id')
      .eq('school_id', schoolId)

    const classMap = new Map<string, string>()
    ;(classRows || []).forEach((c: { id: string; name: string }) => classMap.set(c.name.trim().toLowerCase(), c.id))

    const { data: existingStudents } = await adminSupabase
      .from('students')
      .select('admission_number')
      .eq('school_id', schoolId)

    const { data: existingProfiles } = await adminSupabase
      .from('user_profiles')
      .select('email')

    const existingAdmissions = new Set((existingStudents || []).map((s: { admission_number: string }) => s.admission_number))
    const existingEmails = new Set((existingProfiles || []).map((p: { email: string }) => p.email))
    const inFileAdmissions = new Set<string>()
    const inFileEmails = new Set<string>()

    const failures: ImportFailure[] = []
    const credentials: Array<{
      row: number
      full_name: string
      email: string
      admission_number: string
      temp_password: string
    }> = []

    // First pass: validate all rows and collect into batches for processing
    interface ValidatedRow {
      rowIndex: number
      payload: ImportRow
      classId: string
    }
    const validatedRows: ValidatedRow[] = []

    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex)
      const full_name = normalizeString(row.getCell(1).value)
      const email = normalizeString(row.getCell(2).value)
      const admission_number = normalizeString(row.getCell(3).value)
      const class_name_raw = normalizeString(row.getCell(4).value)
      const gender = normalizeGender(row.getCell(5).value)
      const date_of_birth = normalizeDate(row.getCell(6).value)
      const admission_date = normalizeDate(row.getCell(7).value)
      const roll_number = normalizeString(row.getCell(8).value)
      const phone = normalizeString(row.getCell(9).value)
      const address = normalizeString(row.getCell(10).value)
      const guardian_name = normalizeString(row.getCell(11).value)
      const guardian_phone = normalizeString(row.getCell(12).value)
      const guardian_email = normalizeString(row.getCell(13).value)

      if (!full_name && !email && !admission_number) continue

      if (!full_name || !admission_number || !class_name_raw || !gender || !date_of_birth || !admission_date) {
        failures.push({ row: rowIndex, reason: 'Missing required fields' })
        continue
      }

      if (email && !validateEmail(email)) {
        failures.push({ row: rowIndex, reason: 'Invalid email format' })
        continue
      }

      const classId = classMap.get(class_name_raw.trim().toLowerCase())
      if (!classId) {
        failures.push({ row: rowIndex, reason: `Class not found: ${class_name_raw}` })
        continue
      }

      if (inFileAdmissions.has(admission_number) || existingAdmissions.has(admission_number)) {
        failures.push({ row: rowIndex, reason: `Duplicate admission number: ${admission_number}` })
        continue
      }
      if (email && (inFileEmails.has(email) || existingEmails.has(email))) {
        failures.push({ row: rowIndex, reason: `Duplicate email: ${email}` })
        continue
      }

      inFileAdmissions.add(admission_number)
      if (email) inFileEmails.add(email)

      const payload: ImportRow = {
        full_name,
        email,
        admission_number,
        class_name: class_name_raw,
        gender,
        date_of_birth,
        admission_date,
        roll_number,
        phone,
        address,
        guardian_name,
        guardian_phone,
        guardian_email,
      }

      validatedRows.push({ rowIndex, payload, classId })
    }

    // Second pass: create all auth users in parallel
    interface AuthResult {
      rowIndex: number
      userId?: string
      error?: string
      tempPassword?: string
    }
    const authResults: AuthResult[] = await Promise.all(
      validatedRows.map(async ({ rowIndex, payload }) => {
        const tempPassword = randomTempPassword('Student')
        const finalEmail = payload.email || `student.${payload.admission_number}@school.local`
        const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
          email: finalEmail,
          password: tempPassword,
          email_confirm: true,
        })
        if (authError || !authUser.user) {
          return { rowIndex, error: authError?.message || 'Failed to create auth user' }
        }
        return { rowIndex, userId: authUser.user.id, tempPassword }
      })
    )

    // Track auth failures
    authResults.forEach((result) => {
      if (result.error) {
        failures.push({ row: result.rowIndex, reason: result.error })
      }
    })

    const successfulAuthResults = authResults.filter((r) => !r.error && r.userId)
    let successCount = 0

    // Third pass: create all user_profiles in batch
    if (successfulAuthResults.length > 0) {
      const profileInserts = successfulAuthResults.map((authResult) => {
        const validated = validatedRows.find((vr) => vr.rowIndex === authResult.rowIndex)
        if (!validated) return null
        const { payload } = validated
        const finalEmail = payload.email || `student.${payload.admission_number}@school.local`
        return {
          user_id: authResult.userId,
          school_id: schoolId,
          role: 'student',
          email: finalEmail,
          full_name: payload.full_name,
          status: 'active',
          admission_number: payload.admission_number,
          phone: payload.phone || null,
          address: payload.address || null,
          gender: payload.gender,
          date_of_birth: payload.date_of_birth,
        }
      }).filter(Boolean)

      if (profileInserts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: profileError } = await (adminSupabase as any)
          .from('user_profiles')
          .insert(profileInserts)

        if (profileError) {
          // Delete all auth users if profile batch insert failed
          await Promise.all(
            successfulAuthResults.map((r) =>
              adminSupabase.auth.admin.deleteUser(r.userId!)
            )
          )
          return { success: false, error: `Batch profile creation failed: ${profileError.message}` }
        }

        // Fourth pass: create all students in batch
        const studentInserts = successfulAuthResults.map((authResult) => {
          const validated = validatedRows.find((vr) => vr.rowIndex === authResult.rowIndex)
          if (!validated) return null
          const { payload, classId } = validated
          return {
            user_id: authResult.userId,
            school_id: schoolId,
            admission_number: payload.admission_number,
            roll_number: payload.roll_number || null,
            class_id: classId,
            date_of_birth: payload.date_of_birth,
            gender: payload.gender,
            guardian_name: payload.guardian_name || null,
            guardian_phone: payload.guardian_phone || null,
            guardian_email: payload.guardian_email || null,
            address: payload.address || null,
            admission_date: payload.admission_date,
            is_active: true,
          }
        }).filter(Boolean)

        if (studentInserts.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: studentError } = await (adminSupabase as any)
            .from('students')
            .insert(studentInserts)

          if (studentError) {
            // Delete all resources if student batch insert failed
            await Promise.all(
              successfulAuthResults.map((r) =>
                adminSupabase.auth.admin.deleteUser(r.userId!)
              )
            )
            return { success: false, error: `Batch student creation failed: ${studentError.message}` }
          }

          successCount = studentInserts.length

          // Build credentials list for successful imports
          const credentialsList = successfulAuthResults.map((result) => {
            const validated = validatedRows.find((vr) => vr.rowIndex === result.rowIndex)
            if (!validated) return null
            const finalEmail = validated.payload.email || `student.${validated.payload.admission_number}@school.local`
            return {
              row: result.rowIndex,
              full_name: validated.payload.full_name,
              email: finalEmail,
              admission_number: validated.payload.admission_number,
              temp_password: result.tempPassword || '',
            }
          }).filter((c) => c !== null) as Array<{
            row: number
            full_name: string
            email: string
            admission_number: string
            temp_password: string
          }>
          credentials.push(...credentialsList)
        }
      }
    }

    if (successCount > 0) {
      revalidatePath('/school-admin/students')

      await logAssumptionAwareAudit(adminSupabase, user.id, 'student_bulk_imported', 'student', undefined, {
        schoolId,
        importedCount: successCount,
        failedCount: failures.length,
      })
    }

    return { success: true, result: { imported: successCount, failed: failures, credentials } }
  } catch (error) {
    console.error('Error in importStudents:', error)
    return { success: false, error: 'Failed to import students' }
  }
}
