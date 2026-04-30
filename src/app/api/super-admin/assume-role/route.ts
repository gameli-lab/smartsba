import { NextRequest, NextResponse } from 'next/server'
import {
  ASSUME_ROLE_COOKIE_NAME,
  AssumableRole,
  createAssumeRoleCookieValue,
  getAssumeRoleContextForActor,
  getAssumeRoleTtlSeconds,
  getRequestFingerprintFromHeaders,
} from '@/lib/assume-role'
import { writeAuditLog } from '@/lib/audit-log'
import { buildMfaCookieValue, MFA_VERIFIED_COOKIE_NAME } from '@/lib/mfa-session'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'

const ROLE_TO_PATH: Record<AssumableRole, string> = {
  school_admin: '/school-admin',
  teacher: '/teacher',
  student: '/student',
  parent: '/parent',
}

type PreviewCleanupMetadata = {
  assumption?: {
    actor_user_id?: string
  }
  createdUserIds?: unknown
  parentResolution?: {
    status?: string
    parentProfileId?: string
    parentUserId?: string
  }
}

async function cleanupAssumedPreviewData(admin: ReturnType<typeof createAdminSupabaseClient>, actorUserId: string, issuedAt: number) {
  const issuedAtIso = new Date(issuedAt).toISOString()
  const { data: auditRows, error } = await (admin as any)
    .from('audit_logs')
    .select('created_at, action_type, entity_type, entity_id, metadata')
    .eq('actor_user_id', actorUserId)
    .gte('created_at', issuedAtIso)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const studentUserIds = new Set<string>()
  const teacherUserIds = new Set<string>()
  const parentUserIds = new Set<string>()

  const studentEntityIds = new Set<string>()
  const parentProfileIds = new Set<string>()

  for (const row of (auditRows || []) as Array<{ action_type: string; entity_id: string | null; metadata: PreviewCleanupMetadata | null }>) {
    if (row.metadata?.assumption?.actor_user_id !== actorUserId) continue

    if (row.action_type === 'student_created' && row.entity_id) {
      studentEntityIds.add(row.entity_id)
      const parentResolution = row.metadata?.parentResolution
      if (parentResolution?.status === 'created_and_linked') {
        if (parentResolution.parentUserId) parentUserIds.add(parentResolution.parentUserId)
      }
    }

    if (row.action_type === 'teacher_created' && row.entity_id) {
      teacherUserIds.add(row.entity_id)
    }

    if (row.action_type === 'student_bulk_imported') {
      const createdUserIds = Array.isArray(row.metadata?.createdUserIds) ? row.metadata?.createdUserIds : []
      createdUserIds.forEach((value) => {
        if (typeof value === 'string' && value) studentUserIds.add(value)
      })
    }

    if (row.action_type === 'teacher_bulk_imported') {
      const createdUserIds = Array.isArray(row.metadata?.createdUserIds) ? row.metadata?.createdUserIds : []
      createdUserIds.forEach((value) => {
        if (typeof value === 'string' && value) teacherUserIds.add(value)
      })
    }

    if (row.action_type === 'student_create_auto_parent_created') {
      const parentResolution = row.metadata?.parentResolution
      if (parentResolution?.status === 'created_and_linked') {
        if (parentResolution.parentUserId) parentUserIds.add(parentResolution.parentUserId)
        if (parentResolution.parentProfileId) parentProfileIds.add(parentResolution.parentProfileId)
      }
    }
  }

  if (studentEntityIds.size > 0) {
    const { data: studentRows } = await (admin as any)
      .from('students')
      .select('id, user_id')
      .in('id', Array.from(studentEntityIds))

    ;(studentRows || []).forEach((student: { id: string; user_id: string }) => {
      studentUserIds.add(student.user_id)
      studentEntityIds.add(student.id)
    })
  }

  const studentUserIdList = Array.from(studentUserIds)
  if (studentUserIdList.length > 0) {
    const { data: studentRowsByUser } = await (admin as any)
      .from('students')
      .select('id, user_id')
      .in('user_id', studentUserIdList)

    const studentIds = Array.from(new Set([
      ...Array.from(studentEntityIds),
      ...(studentRowsByUser || []).map((student: { id: string }) => student.id),
    ]))

    if (studentIds.length > 0) {
      await (admin as any).from('parent_student_links').delete().in('student_id', studentIds)
      await (admin as any).from('students').delete().in('user_id', studentUserIdList)
    }
  }

  const teacherIds = Array.from(teacherUserIds)
  if (teacherIds.length > 0) {
    await (admin as any).from('teachers').delete().in('user_id', teacherIds)
  }

  const parentIds = Array.from(parentUserIds)
  if (parentIds.length > 0) {
    const { data: parentProfiles } = await (admin as any)
      .from('user_profiles')
      .select('id, user_id')
      .in('user_id', parentIds)
      .eq('role', 'parent')

    const parentProfileIdList = Array.from(new Set([
      ...parentProfileIds,
      ...(parentProfiles || []).map((profile: { id: string }) => profile.id),
    ]))

    if (parentProfileIdList.length > 0) {
      await (admin as any).from('parent_student_links').delete().in('parent_id', parentProfileIdList)
      await (admin as any).from('parents').delete().in('user_id', parentIds)
      await (admin as any).from('user_profiles').delete().in('user_id', parentIds).eq('role', 'parent')
      await Promise.all(parentIds.map((userId) => admin.auth.admin.deleteUser(userId)))
    }
  }

  if (studentUserIds.size > 0) {
    const studentUserIdList = Array.from(studentUserIds)
    const { data: studentProfiles } = await (admin as any)
      .from('user_profiles')
      .select('user_id')
      .in('user_id', studentUserIdList)
      .eq('role', 'student')

    if ((studentProfiles || []).length > 0) {
      await (admin as any).from('user_profiles').delete().in('user_id', studentUserIdList).eq('role', 'student')
      await Promise.all(studentUserIdList.map((userId) => admin.auth.admin.deleteUser(userId)))
    }
  }

  if (teacherUserIds.size > 0) {
    const teacherUserIdList = Array.from(teacherUserIds)
    const { data: teacherProfiles } = await (admin as any)
      .from('user_profiles')
      .select('user_id')
      .in('user_id', teacherUserIdList)
      .eq('role', 'teacher')

    if ((teacherProfiles || []).length > 0) {
      await (admin as any).from('user_profiles').delete().in('user_id', teacherUserIdList).eq('role', 'teacher')
      await Promise.all(teacherUserIdList.map((userId) => admin.auth.admin.deleteUser(userId)))
    }
  }

  return {
    studentCount: studentUserIds.size,
    teacherCount: teacherUserIds.size,
    parentCount: parentUserIds.size,
  }
}

async function requireSuperAdminContext() {
  const supabase = await createServerComponentClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const admin = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile || (profile as { role?: string }).role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'SysAdmin access required' }, { status: 403 }) }
  }

  return { user, admin }
}

async function enforceSuperAdminMfa(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string, presentedCookie: string | undefined) {
  const { data: enrollment, error } = await admin
    .from('mfa_enrollments')
    .select('enabled, last_used_at')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('last_used_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastUsedAt = (enrollment as { enabled?: boolean; last_used_at?: string | null } | null)?.last_used_at
  if (error || !lastUsedAt) {
    return NextResponse.json({ error: 'MFA verification required to start role preview' }, { status: 403 })
  }

  const expectedCookie = buildMfaCookieValue(userId, lastUsedAt)
  if (!presentedCookie || presentedCookie !== expectedCookie) {
    return NextResponse.json({ error: 'Re-authenticate with MFA before assuming a role' }, { status: 403 })
  }

  return null
}

export async function GET() {
  const contextResult = await requireSuperAdminContext()
  if ('error' in contextResult) return contextResult.error

  const { user, admin } = contextResult
  const assumeContext = await getAssumeRoleContextForActor(user.id)

  if (!assumeContext) {
    return NextResponse.json({ active: false })
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('full_name, email, school_id')
    .eq('user_id', assumeContext.assumedUserId)
    .maybeSingle()

  return NextResponse.json({
    active: true,
    assumedRole: assumeContext.assumedRole,
    assumedUserId: assumeContext.assumedUserId,
    issuedAt: assumeContext.issuedAt,
    target: profile || null,
    destinationPath: ROLE_TO_PATH[assumeContext.assumedRole],
  })
}

export async function POST(req: NextRequest) {
  const contextResult = await requireSuperAdminContext()
  if ('error' in contextResult) return contextResult.error

  const { user, admin } = contextResult
  const mfaError = await enforceSuperAdminMfa(admin, user.id, req.cookies.get(MFA_VERIFIED_COOKIE_NAME)?.value)
  if (mfaError) return mfaError

  const body = (await req.json()) as { role?: AssumableRole; targetUserId?: string }

  if (!body.role || !body.targetUserId) {
    return NextResponse.json({ error: 'role and targetUserId are required' }, { status: 400 })
  }

  if (!Object.keys(ROLE_TO_PATH).includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role for assumption' }, { status: 400 })
  }

  const { data: targetProfile, error: targetError } = await admin
    .from('user_profiles')
    .select('id, role, school_id, full_name, email, user_id')
    .eq('user_id', body.targetUserId)
    .eq('role', body.role)
    .maybeSingle()

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'Target user for selected role not found' }, { status: 404 })
  }

  const now = Date.now()
  const ttlSeconds = getAssumeRoleTtlSeconds()
  const expiresAt = now + ttlSeconds * 1000
  const tokenValue = createAssumeRoleCookieValue({
    actorUserId: user.id,
    assumedUserId: body.targetUserId,
    assumedRole: body.role,
    issuedAt: now,
    expiresAt,
    requestFingerprint: getRequestFingerprintFromHeaders(req.headers),
  })

  await writeAuditLog(admin as any, {
    actorUserId: user.id,
    actorRole: 'super_admin',
    actionType: 'assume_role_started',
    entityType: 'user',
    entityId: (targetProfile as { id: string }).id,
    metadata: {
      assumed_role: body.role,
      assumed_user_id: body.targetUserId,
      assumed_school_id: (targetProfile as { school_id?: string | null }).school_id || null,
    },
  })

  const response = NextResponse.json({
    success: true,
    destinationPath: ROLE_TO_PATH[body.role],
    target: {
      fullName: (targetProfile as { full_name?: string | null }).full_name || null,
      email: (targetProfile as { email?: string | null }).email || null,
    },
  })

  response.cookies.set(ASSUME_ROLE_COOKIE_NAME, tokenValue, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: ttlSeconds,
  })

  return response
}

export async function DELETE(req: NextRequest) {
  const contextResult = await requireSuperAdminContext()
  if ('error' in contextResult) return contextResult.error

  const { user, admin } = contextResult
  const assumeContext = await getAssumeRoleContextForActor(user.id)
  const cleanupMode = req.headers.get('x-preview-cleanup') === 'delete'

  let cleanupResult: { studentCount: number; teacherCount: number; parentCount: number } | null = null

  if (cleanupMode && assumeContext) {
    cleanupResult = await cleanupAssumedPreviewData(admin, user.id, assumeContext.issuedAt)
  }

  if (assumeContext) {
    await writeAuditLog(admin as any, {
      actorUserId: user.id,
      actorRole: 'super_admin',
      actionType: 'assume_role_ended',
      entityType: 'user',
      entityId: null,
      metadata: {
        assumed_role: assumeContext.assumedRole,
        assumed_user_id: assumeContext.assumedUserId,
        cleanup: cleanupMode ? 'deleted' : 'kept',
        cleanup_result: cleanupResult,
      },
    })
  }

  const response = NextResponse.json({ success: true, cleanup: cleanupMode ? 'deleted' : 'kept', cleanupResult })
  response.cookies.set(ASSUME_ROLE_COOKIE_NAME, '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })

  return response
}
