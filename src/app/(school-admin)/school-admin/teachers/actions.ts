'use server'

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient, createAdminSupabaseClient } from '@/lib/supabase'
import { Teacher } from '@/types'

interface CreateTeacherInput {
  full_name: string
  email: string
  staff_id: string
  phone?: string
  gender?: 'male' | 'female'
  date_of_birth?: string
  address?: string
  specialization?: string
  qualification?: string
  hire_date?: string
}

interface UpdateTeacherInput extends Partial<CreateTeacherInput> {
  id: string
}

interface ImportRow {
  full_name: string
  email: string
  staff_id: string
  phone?: string
  gender?: 'male' | 'female'
  date_of_birth?: string
  address?: string
  specialization?: string
  qualification?: string
  hire_date?: string
}

interface ImportFailure {
  row: number
  reason: string
}

interface ImportResult {
  imported: number
  failed: ImportFailure[]
}

/**
 * Create a new teacher
 */
export async function createTeacher(input: CreateTeacherInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    // Validate required fields
    if (!input.full_name || !input.email || !input.staff_id) {
      return { success: false, error: 'Name, email, and staff ID are required' }
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      return { success: false, error: 'Invalid email format' }
    }

    // Check for duplicate staff ID within school
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('school_id', schoolId)
      .eq('staff_id', input.staff_id)
      .single()

    if (existing) {
      return { success: false, error: `Staff ID ${input.staff_id} already exists in your school` }
    }

    // Check for duplicate email
    const { data: existingEmail } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', input.email)
      .single()

    if (existingEmail) {
      return { success: false, error: 'Email address already exists' }
    }

    // Generate a temporary password (should be changed on first login)
    const tempPassword = `Teacher@${Math.random().toString(36).slice(-8)}`

    // Create auth user
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      console.error('Error creating auth user:', authError)
      return { success: false, error: 'Failed to create teacher account' }
    }

    // Create user profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (adminSupabase as any)
      .from('user_profiles')
      .insert({
        user_id: authUser.user.id,
        school_id: schoolId,
        role: 'teacher',
        email: input.email,
        full_name: input.full_name,
        staff_id: input.staff_id,
        phone: input.phone || null,
        gender: input.gender || null,
        date_of_birth: input.date_of_birth || null,
        address: input.address || null,
        status: 'active',
      })

    if (profileError) {
      // Rollback: delete auth user if profile creation fails
      await adminSupabase.auth.admin.deleteUser(authUser.user.id)
      console.error('Error creating user profile:', profileError)
      return { success: false, error: 'Failed to create teacher profile' }
    }

    // Create teacher record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: teacherError } = await (adminSupabase as any)
      .from('teachers')
      .insert({
        school_id: schoolId,
        user_id: authUser.user.id,
        staff_id: input.staff_id,
        specialization: input.specialization || null,
        qualification: input.qualification || null,
        hire_date: input.hire_date || null,
        is_active: true,
      })

    if (teacherError) {
      // Rollback: delete user profile and auth user
      await adminSupabase.from('user_profiles').delete().eq('user_id', authUser.user.id)
      await adminSupabase.auth.admin.deleteUser(authUser.user.id)
      console.error('Error creating teacher record:', teacherError)
      return { success: false, error: 'Failed to create teacher record' }
    }

    // Revalidate after successful creation, but catch any errors to avoid breaking the response
    try {
      revalidatePath('/school-admin/teachers')
    } catch (revalidateError) {
      console.warn('Warning: revalidatePath failed (this may be expected):', revalidateError)
    }
    
    return { 
      success: true, 
      tempPassword, // Return temp password so admin can communicate it to teacher
      message: 'Teacher created successfully'
    }
  } catch (error) {
    console.error('Error in createTeacher:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update teacher information
 */
export async function updateTeacher(input: UpdateTeacherInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    if (!input.id) {
      return { success: false, error: 'Teacher ID is required' }
    }

    // Get teacher to verify ownership
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, school_id, user_id')
      .eq('id', input.id)
      .single()

    const typedTeacher = teacher as Pick<Teacher, 'id' | 'school_id' | 'user_id'> | null

    if (!typedTeacher || typedTeacher.school_id !== schoolId) {
      return { success: false, error: 'Teacher not found' }
    }

    // Update user profile if personal info changed
    if (input.full_name || input.phone || input.gender || input.date_of_birth || input.address) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from('user_profiles')
        .update({
          ...(input.full_name && { full_name: input.full_name }),
          ...(input.phone !== undefined && { phone: input.phone || null }),
          ...(input.gender && { gender: input.gender }),
          ...(input.date_of_birth !== undefined && { date_of_birth: input.date_of_birth || null }),
          ...(input.address !== undefined && { address: input.address || null }),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', typedTeacher.user_id)

      if (profileError) {
        console.error('Error updating user profile:', profileError)
        return { success: false, error: 'Failed to update teacher profile' }
      }
    }

    // Update teacher record if teacher-specific info changed
    if (input.specialization !== undefined || input.qualification !== undefined || input.hire_date !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: teacherError } = await (supabase as any)
        .from('teachers')
        .update({
          ...(input.specialization !== undefined && { specialization: input.specialization || null }),
          ...(input.qualification !== undefined && { qualification: input.qualification || null }),
          ...(input.hire_date !== undefined && { hire_date: input.hire_date || null }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)

      if (teacherError) {
        console.error('Error updating teacher record:', teacherError)
        return { success: false, error: 'Failed to update teacher record' }
      }
    }

    revalidatePath('/school-admin/teachers')
    return { success: true, message: 'Teacher updated successfully' }
  } catch (error) {
    console.error('Error in updateTeacher:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Deactivate/reactivate a teacher
 */
export async function toggleTeacherStatus(teacherId: string, isActive: boolean) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    // Verify ownership
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, school_id, user_id')
      .eq('id', teacherId)
      .single()

    const typedTeacher = teacher as Pick<Teacher, 'id' | 'school_id' | 'user_id'> | null

    if (!typedTeacher || typedTeacher.school_id !== schoolId) {
      return { success: false, error: 'Teacher not found' }
    }

    // Update teacher active status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: teacherError } = await (supabase as any)
      .from('teachers')
      .update({ is_active: isActive })
      .eq('id', teacherId)

    if (teacherError) {
      console.error('Error updating teacher status:', teacherError)
      return { success: false, error: 'Failed to update teacher status' }
    }

    // Update user profile status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (supabase as any)
      .from('user_profiles')
      .update({ status: isActive ? 'active' : 'disabled' })
      .eq('user_id', typedTeacher.user_id)

    if (profileError) {
      console.error('Error updating profile status:', profileError)
      return { success: false, error: 'Failed to update profile status' }
    }

    revalidatePath('/school-admin/teachers')
    return { success: true, message: `Teacher ${isActive ? 'activated' : 'deactivated'} successfully` }
  } catch (error) {
    console.error('Error in toggleTeacherStatus:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a teacher (soft delete by deactivating)
 */
export async function deleteTeacher(teacherId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id

    // Verify ownership
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, school_id')
      .eq('id', teacherId)
      .single()

    const typedTeacher = teacher as Pick<Teacher, 'id' | 'school_id'> | null

    if (!typedTeacher || typedTeacher.school_id !== schoolId) {
      return { success: false, error: 'Teacher not found' }
    }

    // TODO: Check if teacher has assignments or scores before deleting
    // For now, we'll just deactivate instead of hard delete
    return await toggleTeacherStatus(teacherId, false)
  } catch (error) {
    console.error('Error in deleteTeacher:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// -------------------------
// Teacher Import Utilities
// -------------------------

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    // Excel serial number to date
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

async function buildTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Teachers')

  sheet.columns = [
    { header: 'Full Name*', key: 'full_name', width: 25 },
    { header: 'Email*', key: 'email', width: 28 },
    { header: 'Staff ID*', key: 'staff_id', width: 18 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Gender (Male/Female)', key: 'gender', width: 18 },
    { header: 'Date of Birth (YYYY-MM-DD)', key: 'date_of_birth', width: 24 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'Specialization', key: 'specialization', width: 22 },
    { header: 'Qualification', key: 'qualification', width: 20 },
    { header: 'Hire Date (YYYY-MM-DD)', key: 'hire_date', width: 24 },
  ]

  sheet.addRow({
    full_name: 'Jane Doe',
    email: 'jane.doe@example.com',
    staff_id: 'TCH-001',
    phone: '+233201234567',
    gender: 'Female',
    date_of_birth: '1990-05-12',
    address: '123 Main St, Accra',
    specialization: 'Mathematics',
    qualification: 'B.Ed',
    hire_date: '2022-09-01',
  })

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

  return workbook
}

export async function getTeachersTemplate() {
  const workbook = await buildTemplateWorkbook()
  const buffer = await workbook.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer as ArrayBuffer).toString('base64')

  return {
    success: true,
    filename: 'teachers_template.xlsx',
    base64,
  }
}

export async function importTeachers(formData: FormData): Promise<{ success: boolean; result?: ImportResult; error?: string }> {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    const file = formData.get('file') as File | null
    if (!file) {
      return { success: false, error: 'Please select an Excel file to import' }
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File size exceeds 5MB limit' }
    }

    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Only Excel .xlsx files are supported' }
    }

    const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]

    if (!sheet) {
      return { success: false, error: 'Excel file is empty or invalid' }
    }

    // Fetch existing staff IDs and emails for uniqueness checks
    const { data: existingTeachers } = await supabase
      .from('teachers')
      .select('staff_id')
      .eq('school_id', schoolId)

    const { data: existingProfiles } = await supabase
      .from('user_profiles')
      .select('email')

    const existingStaffIds = new Set((existingTeachers || []).map((t: { staff_id: string }) => t.staff_id))
    const existingEmails = new Set((existingProfiles || []).map((p: { email: string }) => p.email))

    const inFileStaffIds = new Set<string>()
    const inFileEmails = new Set<string>()

    const failures: ImportFailure[] = []
    let successCount = 0

    // Start from row 2 (row 1 is header)
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex)
      const full_name = normalizeString(row.getCell(1).value)
      const email = normalizeString(row.getCell(2).value)
      const staff_id = normalizeString(row.getCell(3).value)
      const phone = normalizeString(row.getCell(4).value)
      const gender = normalizeGender(row.getCell(5).value)
      const date_of_birth = normalizeDate(row.getCell(6).value)
      const address = normalizeString(row.getCell(7).value)
      const specialization = normalizeString(row.getCell(8).value)
      const qualification = normalizeString(row.getCell(9).value)
      const hire_date = normalizeDate(row.getCell(10).value)

      // Skip completely blank rows
      if (!full_name && !email && !staff_id) {
        continue
      }

      if (!full_name || !email || !staff_id) {
        failures.push({ row: rowIndex, reason: 'Full Name, Email, and Staff ID are required' })
        continue
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failures.push({ row: rowIndex, reason: 'Invalid email format' })
        continue
      }

      if (inFileStaffIds.has(staff_id) || existingStaffIds.has(staff_id)) {
        failures.push({ row: rowIndex, reason: `Duplicate staff ID: ${staff_id}` })
        continue
      }

      if (inFileEmails.has(email) || existingEmails.has(email)) {
        failures.push({ row: rowIndex, reason: `Duplicate email: ${email}` })
        continue
      }

      inFileStaffIds.add(staff_id)
      inFileEmails.add(email)

      const teacherPayload: ImportRow = {
        full_name,
        email,
        staff_id,
        phone,
        gender,
        date_of_birth,
        address,
        specialization,
        qualification,
        hire_date,
      }

      // Process creation similar to createTeacher with rollback on failure
      const tempPassword = `Teacher@${Math.random().toString(36).slice(-8)}`

      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email: teacherPayload.email,
        password: tempPassword,
        email_confirm: true,
      })

      if (authError || !authUser.user) {
        failures.push({ row: rowIndex, reason: authError?.message || 'Failed to create auth user' })
        continue
      }

      const userId = authUser.user.id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (adminSupabase as any)
        .from('user_profiles')
        .insert({
          user_id: userId,
          full_name: teacherPayload.full_name,
          email: teacherPayload.email,
          staff_id: teacherPayload.staff_id,
          phone: teacherPayload.phone || null,
          gender: teacherPayload.gender || null,
          date_of_birth: teacherPayload.date_of_birth || null,
          address: teacherPayload.address || null,
          role: 'teacher',
          status: 'active',
          school_id: schoolId,
        })

      if (profileError) {
        console.error('Rollback: deleting auth user after profile error', profileError)
        await adminSupabase.auth.admin.deleteUser(userId)
        failures.push({ row: rowIndex, reason: profileError.message })
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: teacherError } = await (adminSupabase as any)
        .from('teachers')
        .insert({
          user_id: userId,
          school_id: schoolId,
          staff_id: teacherPayload.staff_id,
          specialization: teacherPayload.specialization || null,
          qualification: teacherPayload.qualification || null,
          hire_date: teacherPayload.hire_date || null,
          is_active: true,
        })

      if (teacherError) {
        console.error('Rollback: deleting auth user after teacher error', teacherError)
        await adminSupabase.auth.admin.deleteUser(userId)
        failures.push({ row: rowIndex, reason: teacherError.message })
        continue
      }

      successCount += 1
    }

    if (successCount > 0) {
      revalidatePath('/school-admin/teachers')
    }

    return {
      success: true,
      result: {
        imported: successCount,
        failed: failures,
      },
    }
  } catch (error) {
    console.error('Error in importTeachers:', error)
    return { success: false, error: 'Failed to import teachers' }
  }
}
