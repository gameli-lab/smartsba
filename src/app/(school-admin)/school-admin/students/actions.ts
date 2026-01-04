'use server'

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'
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
  email: string
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

async function buildTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Students')

  sheet.columns = [
    { header: 'Full Name*', key: 'full_name', width: 25 },
    { header: 'Email*', key: 'email', width: 28 },
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
    class_name: 'JHS 1',
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
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

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

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
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
    const { error: profileError } = await (supabase as any)
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
      await supabase.auth.admin.deleteUser(userId)
      return { success: false, error: 'Failed to create student profile' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: studentError } = await (supabase as any)
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

    if (studentError) {
      console.error('Rollback: deleting auth user after student error', studentError)
      await supabase.auth.admin.deleteUser(userId)
      return { success: false, error: 'Failed to create student record' }
    }

    revalidatePath('/school-admin/students')
    return { success: true, tempPassword }
  } catch (error) {
    console.error('Error in createStudent:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateStudent(input: UpdateStudentInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

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
    return { success: true }
  } catch (error) {
    console.error('Error in updateStudent:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function toggleStudentStatus(studentId: string, isActive: boolean) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id, user_id')
      .eq('id', studentId)
      .single()

    const student = studentRow as Pick<Student, 'id' | 'school_id' | 'user_id'> | null
    if (!student || student.school_id !== schoolId) return { success: false, error: 'Student not found' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: studentError } = await (supabase as any)
      .from('students')
      .update({ is_active: isActive })
      .eq('id', studentId)

    if (studentError) {
      console.error('Error updating student status:', studentError)
      return { success: false, error: 'Failed to update student status' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (supabase as any)
      .from('user_profiles')
      .update({ status: isActive ? 'active' : 'disabled' })
      .eq('user_id', student.user_id)

    if (profileError) {
      console.error('Error updating profile status:', profileError)
      return { success: false, error: 'Failed to update profile status' }
    }

    revalidatePath('/school-admin/students')
    return { success: true }
  } catch (error) {
    console.error('Error in toggleStudentStatus:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteStudent(studentId: string) {
  // Soft delete via deactivation
  return toggleStudentStatus(studentId, false)
}

export async function importStudents(formData: FormData): Promise<{ success: boolean; result?: ImportResult; error?: string }> {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'Please select an Excel file to import' }
    if (file.size > 5 * 1024 * 1024) return { success: false, error: 'File size exceeds 5MB limit' }
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) return { success: false, error: 'Only Excel .xlsx files are supported' }

    const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
    const workbook = new ExcelJS.Workbook()
    // ExcelJS typings are strict; cast to any for compatibility
    await workbook.xlsx.load(buffer as any)
    const sheet = workbook.worksheets[0]
    if (!sheet) return { success: false, error: 'Excel file is empty or invalid' }

    // Fetch classes for name mapping
    const { data: classRows } = await supabase
      .from('classes')
      .select('id, name, school_id')
      .eq('school_id', schoolId)

    const classMap = new Map<string, string>()
    ;(classRows || []).forEach((c: { id: string; name: string }) => classMap.set(c.name.trim().toLowerCase(), c.id))

    const { data: existingStudents } = await supabase
      .from('students')
      .select('admission_number')
      .eq('school_id', schoolId)

    const { data: existingProfiles } = await supabase
      .from('user_profiles')
      .select('email')

    const existingAdmissions = new Set((existingStudents || []).map((s: { admission_number: string }) => s.admission_number))
    const existingEmails = new Set((existingProfiles || []).map((p: { email: string }) => p.email))
    const inFileAdmissions = new Set<string>()
    const inFileEmails = new Set<string>()

    const failures: ImportFailure[] = []
    let successCount = 0

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

      if (!full_name || !email || !admission_number || !class_name_raw || !gender || !date_of_birth || !admission_date) {
        failures.push({ row: rowIndex, reason: 'Missing required fields' })
        continue
      }

      if (!validateEmail(email)) {
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
      if (inFileEmails.has(email) || existingEmails.has(email)) {
        failures.push({ row: rowIndex, reason: `Duplicate email: ${email}` })
        continue
      }

      inFileAdmissions.add(admission_number)
      inFileEmails.add(email)

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

      const tempPassword = randomTempPassword('Student')

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: payload.email,
        password: tempPassword,
        email_confirm: true,
      })

      if (authError || !authUser.user) {
        failures.push({ row: rowIndex, reason: authError?.message || 'Failed to create auth user' })
        continue
      }

      const userId = authUser.user.id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from('user_profiles')
        .insert({
          user_id: userId,
          school_id: schoolId,
          role: 'student',
          email: payload.email,
          full_name: payload.full_name,
          status: 'active',
          admission_number: payload.admission_number,
          phone: payload.phone || null,
          address: payload.address || null,
          gender: payload.gender,
          date_of_birth: payload.date_of_birth,
        })

      if (profileError) {
        await supabase.auth.admin.deleteUser(userId)
        failures.push({ row: rowIndex, reason: profileError.message })
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: studentError } = await (supabase as any)
        .from('students')
        .insert({
          user_id: userId,
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
        })

      if (studentError) {
        await supabase.auth.admin.deleteUser(userId)
        failures.push({ row: rowIndex, reason: studentError.message })
        continue
      }

      successCount += 1
    }

    if (successCount > 0) {
      revalidatePath('/school-admin/students')
    }

    return { success: true, result: { imported: successCount, failed: failures } }
  } catch (error) {
    console.error('Error in importStudents:', error)
    return { success: false, error: 'Failed to import students' }
  }
}
