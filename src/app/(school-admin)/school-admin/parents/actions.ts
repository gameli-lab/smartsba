'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import logAudit from '@/lib/audit'

interface CreateParentInput {
  full_name: string
  email: string
  phone?: string
  student_ids: string[]
  relationship?: string
}

interface LinkParentInput {
  parent_profile_id: string
  student_id: string
  relationship?: string
  is_primary?: boolean
}

type ParentProfileLite = {
  id: string
  user_id: string
  full_name: string
  email: string | null
  phone: string | null
}

function randomTempPassword(prefix: string) {
  return `${prefix}@${Math.random().toString(36).slice(-8)}`
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizePhone(value?: string | null) {
  if (!value) return null
  return value.replace(/[^0-9+]/g, '')
}

async function findExistingParentMatch(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  guardianName: string | null,
  guardianEmail: string | null,
  guardianPhone: string | null
): Promise<{ match: ParentProfileLite | null; error?: string }> {
  if (guardianEmail) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, phone')
      .eq('role', 'parent')
      .eq('email', guardianEmail)
      .maybeSingle()

    if (data) return { match: data as ParentProfileLite }
  }

  const phone = normalizePhone(guardianPhone)
  if (phone) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, phone')
      .eq('role', 'parent')
      .eq('phone', phone)

    const rows = (data || []) as ParentProfileLite[]
    if (rows.length === 1) return { match: rows[0] }
    if (rows.length > 1) {
      return { match: null, error: 'Multiple parent accounts match the guardian phone. Use Parent Management to link manually.' }
    }
  }

  if (guardianName) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name, email, phone')
      .eq('role', 'parent')
      .eq('full_name', guardianName)

    const rows = (data || []) as ParentProfileLite[]
    if (rows.length === 1) return { match: rows[0] }
    if (rows.length > 1) {
      return { match: null, error: 'Multiple parent accounts match the guardian name. Use Parent Management to link manually.' }
    }
  }

  return { match: null }
}

export async function createParentAndLink(input: CreateParentInput) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    if (!input.full_name?.trim() || !input.email?.trim()) {
      return { success: false, error: 'Parent name and email are required.' }
    }

    if (!validateEmail(input.email.trim())) {
      return { success: false, error: 'Invalid email format.' }
    }

    const studentIds = Array.from(new Set((input.student_ids || []).filter(Boolean)))

    const { data: existingProfileRow } = await supabase
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('email', input.email.trim())
      .maybeSingle()

    const existingProfile = existingProfileRow as { id: string; user_id: string; role: string } | null

    if (existingProfile && existingProfile.role !== 'parent') {
      return { success: false, error: `Email already exists as ${existingProfile.role}. Use another email for parent account.` }
    }

    if (studentIds.length > 0) {
      const { data: studentsData } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .in('id', studentIds)

      const validStudentIds = new Set((studentsData || []).map((s: { id: string }) => s.id))
      if (validStudentIds.size !== studentIds.length) {
        return { success: false, error: 'One or more selected wards are invalid for your school.' }
      }
    }

    let parentProfileId = existingProfile?.id || null
    let parentUserId = existingProfile?.user_id || null
    let tempPassword: string | null = null
    let createdNew = false

    if (!parentProfileId || !parentUserId) {
      tempPassword = randomTempPassword('Parent')

      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email: input.email.trim(),
        password: tempPassword,
        email_confirm: true,
      })

      if (authError || !authUser.user) {
        return { success: false, error: 'Failed to create parent auth account.' }
      }

      parentUserId = authUser.user.id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileRow, error: profileError } = await (adminSupabase as any)
        .from('user_profiles')
        .insert({
          user_id: parentUserId,
          school_id: schoolId,
          role: 'parent',
          email: input.email.trim(),
          full_name: input.full_name.trim(),
          status: 'active',
          phone: input.phone?.trim() || null,
        })
        .select('id')
        .single()

      if (profileError || !profileRow?.id) {
        await adminSupabase.auth.admin.deleteUser(parentUserId)
        return { success: false, error: 'Failed to create parent profile.' }
      }

      parentProfileId = profileRow.id as string
      createdNew = true
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any)
        .from('user_profiles')
        .update({
          school_id: schoolId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parentProfileId)
        .eq('role', 'parent')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from('parents')
      .upsert({
        user_id: parentUserId,
        contact_phone: input.phone?.trim() || null,
      }, { onConflict: 'user_id' })

    const relationship = input.relationship?.trim() || 'Guardian'

    let linkedCount = 0
    if (studentIds.length > 0) {
      const { data: existingLinks } = await supabase
        .from('parent_student_links')
        .select('student_id')
        .eq('parent_id', parentProfileId)
        .in('student_id', studentIds)

      const alreadyLinked = new Set((existingLinks || []).map((row: { student_id: string }) => row.student_id))
      const pendingLinks = studentIds.filter((id) => !alreadyLinked.has(id))

      if (pendingLinks.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: linksError } = await (adminSupabase as any)
          .from('parent_student_links')
          .insert(
            pendingLinks.map((studentId, index) => ({
              parent_id: parentProfileId,
              student_id: studentId,
              relationship,
              is_primary: index === 0,
            }))
          )

        if (linksError) {
          if (createdNew && parentUserId) {
            await adminSupabase.auth.admin.deleteUser(parentUserId)
          }
          return { success: false, error: 'Failed to link parent to selected wards.' }
        }
      }

      linkedCount = pendingLinks.length
    }

    const auditAction = createdNew
      ? linkedCount > 0
        ? 'create_parent_and_link'
        : 'create_parent_only'
      : linkedCount > 0
        ? 'link_existing_parent_from_create_flow'
        : 'reuse_existing_parent_no_link'

    await logAudit(adminSupabase, user.id, auditAction, 'user_profile', parentProfileId, {
      schoolId,
      linkedStudentIds: studentIds,
      createdNew,
      linkedCount,
    })

    revalidatePath('/school-admin/parents')
    revalidatePath('/school-admin/students')

    return { success: true, tempPassword, createdNew, linkedCount }
  } catch (error) {
    console.error('createParentAndLink error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function linkExistingParentToWard(input: LinkParentInput) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    if (!input.parent_profile_id || !input.student_id) {
      return { success: false, error: 'Parent and ward are required.' }
    }

    const [{ data: parentProfile }, { data: studentRow }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, role')
        .eq('id', input.parent_profile_id)
        .eq('role', 'parent')
        .maybeSingle(),
      supabase
        .from('students')
        .select('id, school_id')
        .eq('id', input.student_id)
        .eq('school_id', schoolId)
        .maybeSingle(),
    ])

    if (!parentProfile) return { success: false, error: 'Parent not found.' }
    if (!studentRow) return { success: false, error: 'Ward not found for your school.' }

    const { data: existingLink } = await supabase
      .from('parent_student_links')
      .select('id')
      .eq('parent_id', input.parent_profile_id)
      .eq('student_id', input.student_id)
      .maybeSingle()

    if (existingLink) {
      return { success: false, error: 'This parent is already linked to the selected ward.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminSupabase as any)
      .from('parent_student_links')
      .insert({
        parent_id: input.parent_profile_id,
        student_id: input.student_id,
        relationship: input.relationship?.trim() || 'Guardian',
        is_primary: input.is_primary || false,
      })

    if (error) {
      return { success: false, error: 'Failed to link parent to ward.' }
    }

    await logAudit(adminSupabase, user.id, 'link_parent_to_ward', 'student', input.student_id, {
      schoolId,
      parentProfileId: input.parent_profile_id,
    })

    revalidatePath('/school-admin/parents')
    revalidatePath('/school-admin/students')

    return { success: true }
  } catch (error) {
    console.error('linkExistingParentToWard error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function unlinkParentFromWard(linkId: string) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    const { data: linkRow } = await supabase
      .from('parent_student_links')
      .select('id, parent_id, student_id, students!inner(id, school_id)')
      .eq('id', linkId)
      .eq('students.school_id', schoolId)
      .maybeSingle()

    if (!linkRow) return { success: false, error: 'Link not found.' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminSupabase as any)
      .from('parent_student_links')
      .delete()
      .eq('id', linkId)

    if (error) return { success: false, error: 'Failed to unlink ward.' }

    await logAudit(adminSupabase, user.id, 'unlink_parent_from_ward', 'parent_student_link', linkId, {
      parentId: (linkRow as any).parent_id,
      studentId: (linkRow as any).student_id,
    })

    revalidatePath('/school-admin/parents')
    revalidatePath('/school-admin/students')

    return { success: true }
  } catch (error) {
    console.error('unlinkParentFromWard error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function toggleParentStatus(parentProfileId: string, status: 'active' | 'disabled') {
  try {
    const { user } = await requireSchoolAdmin()
    const adminSupabase = createAdminSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminSupabase as any)
      .from('user_profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', parentProfileId)
      .eq('role', 'parent')

    if (error) return { success: false, error: 'Failed to update parent status.' }

    await logAudit(adminSupabase, user.id, 'update_parent_status', 'user_profile', parentProfileId, { status })

    revalidatePath('/school-admin/parents')
    return { success: true }
  } catch (error) {
    console.error('toggleParentStatus error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function promoteGuardianFromStudent(studentId: string) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id, guardian_name, guardian_email, guardian_phone')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle()

    const student = studentRow as {
      id: string
      school_id: string
      guardian_name: string | null
      guardian_email: string | null
      guardian_phone: string | null
    } | null

    if (!student) {
      return { success: false, error: 'Student not found for this school.' }
    }

    const guardianName = student.guardian_name?.trim() || null
    const guardianEmail = student.guardian_email?.trim().toLowerCase() || null
    const guardianPhone = normalizePhone(student.guardian_phone)

    if (!guardianName && !guardianEmail && !guardianPhone) {
      return { success: false, error: 'No guardian contact data found on this student.' }
    }

    const { match, error: matchError } = await findExistingParentMatch(supabase, guardianName, guardianEmail, guardianPhone)
    if (matchError) {
      return { success: false, error: matchError }
    }

    let parentProfileId = match?.id || null
    let createdNew = false
    let tempPassword: string | null = null

    if (!parentProfileId) {
      if (!guardianEmail || !validateEmail(guardianEmail)) {
        return { success: false, error: 'Guardian email is required to create a new parent account.' }
      }

      const temp = randomTempPassword('Parent')
      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email: guardianEmail,
        password: temp,
        email_confirm: true,
      })

      if (authError || !authUser.user) {
        return { success: false, error: 'Failed to create parent auth account.' }
      }

      const userId = authUser.user.id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileData, error: profileError } = await (adminSupabase as any)
        .from('user_profiles')
        .insert({
          user_id: userId,
          school_id: schoolId,
          role: 'parent',
          email: guardianEmail,
          full_name: guardianName || 'Parent Guardian',
          status: 'active',
          phone: guardianPhone,
        })
        .select('id')
        .single()

      if (profileError || !profileData?.id) {
        await adminSupabase.auth.admin.deleteUser(userId)
        return { success: false, error: 'Failed to create parent profile.' }
      }

      parentProfileId = profileData.id as string
      createdNew = true
      tempPassword = temp

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any)
        .from('parents')
        .upsert({ user_id: userId, contact_phone: guardianPhone }, { onConflict: 'user_id' })
    }

    if (!parentProfileId) {
      return { success: false, error: 'Unable to resolve parent account.' }
    }

    const studentIdsToLink = new Set<string>([student.id])

    if (guardianEmail) {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('guardian_email', guardianEmail)
      ;(data || []).forEach((row: { id: string }) => studentIdsToLink.add(row.id))
    }

    if (guardianPhone) {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('guardian_phone', guardianPhone)
      ;(data || []).forEach((row: { id: string }) => studentIdsToLink.add(row.id))
    }

    const linkTargets = Array.from(studentIdsToLink)

    const { data: existingLinks } = await supabase
      .from('parent_student_links')
      .select('student_id')
      .eq('parent_id', parentProfileId)
      .in('student_id', linkTargets)

    const linkedAlready = new Set((existingLinks || []).map((l: { student_id: string }) => l.student_id))
    const newLinks = linkTargets.filter((id) => !linkedAlready.has(id))

    if (newLinks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: linkError } = await (adminSupabase as any)
        .from('parent_student_links')
        .insert(
          newLinks.map((id, index) => ({
            parent_id: parentProfileId,
            student_id: id,
            relationship: 'Guardian',
            is_primary: index === 0,
          }))
        )

      if (linkError) {
        return { success: false, error: 'Failed to link parent to ward(s).' }
      }
    }

    await logAudit(
      adminSupabase,
      user.id,
      createdNew ? 'promote_guardian_create_parent' : 'promote_guardian_link_parent',
      'student',
      student.id,
      {
        schoolId,
        parentProfileId,
        linkedStudentIds: linkTargets,
        createdNew,
      }
    )

    revalidatePath('/school-admin/parents')
    revalidatePath('/school-admin/students')
    revalidatePath(`/school-admin/students/${student.id}`)

    return {
      success: true,
      createdNew,
      linkedCount: linkTargets.length,
      tempPassword,
    }
  } catch (error) {
    console.error('promoteGuardianFromStudent error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function findGuardianParentCandidates(studentId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id, guardian_name, guardian_email, guardian_phone')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle()

    const student = studentRow as {
      id: string
      guardian_name: string | null
      guardian_email: string | null
      guardian_phone: string | null
    } | null

    if (!student) {
      return { success: false, error: 'Student not found for this school.', candidates: [] as ParentProfileLite[] }
    }

    const guardianName = student.guardian_name?.trim() || null
    const guardianEmail = student.guardian_email?.trim().toLowerCase() || null
    const guardianPhone = normalizePhone(student.guardian_phone)

    const candidates = new Map<string, ParentProfileLite>()

    if (guardianEmail) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, user_id, full_name, email, phone')
        .eq('role', 'parent')
        .eq('email', guardianEmail)
      const rows = (data || []) as ParentProfileLite[]
      rows.forEach((row) => candidates.set(row.id, row))
    }

    if (guardianPhone) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, user_id, full_name, email, phone')
        .eq('role', 'parent')
        .eq('phone', guardianPhone)
      const rows = (data || []) as ParentProfileLite[]
      rows.forEach((row) => candidates.set(row.id, row))
    }

    if (guardianName) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, user_id, full_name, email, phone')
        .eq('role', 'parent')
        .eq('full_name', guardianName)
      const rows = (data || []) as ParentProfileLite[]
      rows.forEach((row) => candidates.set(row.id, row))
    }

    return { success: true, error: null, candidates: Array.from(candidates.values()) }
  } catch (error) {
    console.error('findGuardianParentCandidates error', error)
    return { success: false, error: 'Failed to load parent candidates.', candidates: [] as ParentProfileLite[] }
  }
}

export async function linkStudentGuardianToParent(studentId: string, parentProfileId: string) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    const [{ data: studentRow }, { data: parentRow }] = await Promise.all([
      supabase
        .from('students')
        .select('id, school_id, guardian_email, guardian_phone')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('id, role')
        .eq('id', parentProfileId)
        .eq('role', 'parent')
        .maybeSingle(),
    ])

    const student = studentRow as { id: string; guardian_email: string | null; guardian_phone: string | null } | null
    if (!student) return { success: false, error: 'Student not found.' }
    if (!parentRow) return { success: false, error: 'Parent profile not found.' }

    const targets = new Set<string>([student.id])
    if (student.guardian_email) {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('guardian_email', student.guardian_email)
      ;(data || []).forEach((row: { id: string }) => targets.add(row.id))
    }
    if (student.guardian_phone) {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('guardian_phone', student.guardian_phone)
      ;(data || []).forEach((row: { id: string }) => targets.add(row.id))
    }

    const targetIds = Array.from(targets)
    const { data: existingLinks } = await supabase
      .from('parent_student_links')
      .select('student_id')
      .eq('parent_id', parentProfileId)
      .in('student_id', targetIds)

    const existing = new Set((existingLinks || []).map((row: { student_id: string }) => row.student_id))
    const missing = targetIds.filter((id) => !existing.has(id))

    if (missing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminSupabase as any)
        .from('parent_student_links')
        .insert(
          missing.map((id, index) => ({
            parent_id: parentProfileId,
            student_id: id,
            relationship: 'Guardian',
            is_primary: index === 0,
          }))
        )

      if (error) return { success: false, error: 'Failed to link selected parent.' }
    }

    await logAudit(adminSupabase, user.id, 'resolve_guardian_parent_match', 'student', studentId, {
      schoolId,
      parentProfileId,
      linkedStudentIds: targetIds,
    })

    revalidatePath('/school-admin/parents')
    revalidatePath('/school-admin/students')
    revalidatePath(`/school-admin/students/${studentId}`)

    return { success: true, linkedCount: targetIds.length }
  } catch (error) {
    console.error('linkStudentGuardianToParent error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function syncGuardianSnapshotToLinkedParents(studentId: string) {
  try {
    const { user, profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    const { data: studentRow } = await supabase
      .from('students')
      .select('id, school_id, guardian_name, guardian_phone')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle()

    const student = studentRow as { id: string; guardian_name: string | null; guardian_phone: string | null } | null
    if (!student) return { success: false, error: 'Student not found.' }

    const { data: linkRows } = await supabase
      .from('parent_student_links')
      .select('parent_id')
      .eq('student_id', studentId)

    const parentIds = Array.from(new Set((linkRows || []).map((row: { parent_id: string }) => row.parent_id)))
    if (parentIds.length === 0) {
      return { success: false, error: 'No linked parent accounts to sync.' }
    }

    const normalizedPhone = normalizePhone(student.guardian_phone)
    let updated = 0

    for (const parentId of parentIds) {
      const { data: parentRaw } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone')
        .eq('id', parentId)
        .eq('role', 'parent')
        .maybeSingle()

      const parent = parentRaw as { id: string; full_name: string | null; phone: string | null } | null

      if (!parent) continue

      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      let shouldUpdate = false

      if (!parent.phone && normalizedPhone) {
        updatePayload.phone = normalizedPhone
        shouldUpdate = true
      }

      if ((parent.full_name === 'Parent Guardian' || !parent.full_name) && student.guardian_name) {
        updatePayload.full_name = student.guardian_name
        shouldUpdate = true
      }

      if (shouldUpdate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any)
          .from('user_profiles')
          .update(updatePayload)
          .eq('id', parentId)
          .eq('role', 'parent')
        updated += 1
      }
    }

    await logAudit(adminSupabase, user.id, 'sync_guardian_snapshot_to_parent', 'student', studentId, {
      schoolId,
      updatedParentCount: updated,
    })

    revalidatePath('/school-admin/parents')
    revalidatePath(`/school-admin/students/${studentId}`)

    return { success: true, updatedParentCount: updated }
  } catch (error) {
    console.error('syncGuardianSnapshotToLinkedParents error', error)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
