"use server"

import { supabase } from '@/lib/supabase'

interface ExportResult {
  success: boolean
  data?: string
  filename?: string
  error?: string
}

interface SchoolRow {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  status: string
  created_at: string
  updated_at: string
}

interface SchoolRelation {
  name: string | null
}

interface UserProfileExportRow {
  id: string
  user_id: string | null
  full_name: string | null
  role: string
  school_id: string | null
  created_at: string
  updated_at: string
  schools: SchoolRelation | SchoolRelation[] | null
}

interface AuditActorRelation {
  full_name: string | null
}

interface AuditLogExportRow {
  id: string
  actor_user_id: string | null
  actor_role: string | null
  action_type: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_profiles: AuditActorRelation | AuditActorRelation[] | null
}

interface UserRoleRow {
  role: string
  school_id: string | null
}

interface LogAuditActionParams {
  p_actor_user_id: string
  p_actor_role: string
  p_action_type: string
  p_entity_type: string
  p_entity_id: string | null
  p_metadata: Record<string, unknown>
}

interface AuditRpcClient {
  rpc(functionName: 'log_audit_action', params: LogAuditActionParams): Promise<unknown>
}

const auditRpcClient = supabase as unknown as AuditRpcClient

function getSchoolName(schools: UserProfileExportRow['schools']): string {
  if (Array.isArray(schools)) {
    return schools[0]?.name ?? ''
  }

  return schools?.name ?? ''
}

function getActorName(userProfiles: AuditLogExportRow['user_profiles']): string {
  if (Array.isArray(userProfiles)) {
    return userProfiles[0]?.full_name ?? 'Unknown'
  }

  return userProfiles?.full_name ?? 'Unknown'
}

export async function exportSchoolsToCSV(
  userId: string,
  userRole: string,
  filters?: {
    status?: string
    search?: string
    dateRange?: string
  }
): Promise<ExportResult> {
  try {
    // Verify user is super_admin
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: SysAdmin privileges required' }
    }

    // Fetch schools data
    let query = supabase
      .from('schools')
      .select(`
        id,
        name,
        email,
        phone,
        address,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    // Apply filters if provided
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }

    const { data: schools, error } = await query

    if (error) {
      console.error('Error fetching schools:', error)
      return { success: false, error: error.message }
    }

    // Generate CSV content
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Address', 'Status', 'Created At', 'Updated At']
    const csvRows = [headers.join(',')]

    const schoolsData = (schools ?? []) as SchoolRow[]

    schoolsData?.forEach((school) => {
      const row = [
        school.id,
        `"${school.name || ''}"`,
        `"${school.email || ''}"`,
        `"${school.phone || ''}"`,
        `"${school.address || ''}"`,
        school.status,
        school.created_at,
        school.updated_at,
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `schools_export_${timestamp}.csv`

    // Log to audit trail
    await auditRpcClient.rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'export_csv',
      p_entity_type: 'school',
      p_entity_id: null,
      p_metadata: {
        export_type: 'csv',
        record_count: schoolsData?.length || 0,
        filters: filters,
        filename: filename,
      },
    })

    return {
      success: true,
      data: csvContent,
      filename: filename,
    }
  } catch (err) {
    console.error('Error in exportSchoolsToCSV:', err)
    return { success: false, error: 'Failed to export schools' }
  }
}

export async function exportUsersToCSV(
  userId: string,
  userRole: string,
  filters?: {
    role?: string
    search?: string
  }
): Promise<ExportResult> {
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: SysAdmin privileges required' }
    }

    // Fetch users with school info
    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        user_id,
        full_name,
        role,
        school_id,
        created_at,
        updated_at,
        schools (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (filters?.role && filters.role !== 'all') {
      query = query.eq('role', filters.role)
    }

    if (filters?.search) {
      query = query.or(`full_name.ilike.%${filters.search}%`)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return { success: false, error: error.message }
    }

    // Get emails from auth.users
    const usersData = (users ?? []) as UserProfileExportRow[]
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const emailMap = new Map(authUsers?.users.map((u) => [u.id, u.email]))

    // Generate CSV content
    const headers = ['ID', 'Name', 'Email', 'Role', 'School', 'Created At', 'Updated At']
    const csvRows = [headers.join(',')]

    usersData?.forEach((user) => {
      const email = user.user_id ? emailMap.get(user.user_id) : ''
      const schoolName = getSchoolName(user.schools)
      const row = [
        user.id,
        `"${user.full_name || ''}"`,
        `"${email || ''}"`,
        user.role,
        `"${schoolName}"`,
        user.created_at,
        user.updated_at,
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `users_export_${timestamp}.csv`

    // Log to audit trail
    await auditRpcClient.rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'export_csv',
      p_entity_type: 'user',
      p_entity_id: null,
      p_metadata: {
        export_type: 'csv',
        record_count: usersData?.length || 0,
        filters: filters,
        filename: filename,
      },
    })

    return {
      success: true,
      data: csvContent,
      filename: filename,
    }
  } catch (err) {
    console.error('Error in exportUsersToCSV:', err)
    return { success: false, error: 'Failed to export users' }
  }
}

export async function exportAuditLogsToCSV(
  userId: string,
  userRole: string,
  filters?: {
    actionType?: string
    entityType?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<ExportResult> {
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: SysAdmin privileges required' }
    }

    // Fetch audit logs
    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        actor_user_id,
        actor_role,
        action_type,
        entity_type,
        entity_id,
        metadata,
        created_at,
        user_profiles (
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (filters?.actionType && filters.actionType !== 'all') {
      query = query.eq('action_type', filters.actionType)
    }

    if (filters?.entityType && filters.entityType !== 'all') {
      query = query.eq('entity_type', filters.entityType)
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return { success: false, error: error.message }
    }

    // Generate CSV content
    const headers = ['ID', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Metadata', 'Created At']
    const csvRows = [headers.join(',')]

    const logsData = (logs ?? []) as AuditLogExportRow[]

    logsData?.forEach((log) => {
      const actorName = getActorName(log.user_profiles)
      const metadataStr = log.metadata ? JSON.stringify(log.metadata) : ''
      const row = [
        log.id,
        `"${actorName}"`,
        log.actor_role,
        log.action_type,
        log.entity_type,
        log.entity_id || '',
        `"${metadataStr.replace(/"/g, '""')}"`,
        log.created_at,
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `audit_logs_export_${timestamp}.csv`

    // Log to audit trail
    await auditRpcClient.rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'export_csv',
      p_entity_type: 'audit_log',
      p_entity_id: null,
      p_metadata: {
        export_type: 'csv',
        record_count: logsData?.length || 0,
        filters: filters,
        filename: filename,
      },
    })

    return {
      success: true,
      data: csvContent,
      filename: filename,
    }
  } catch (err) {
    console.error('Error in exportAuditLogsToCSV:', err)
    return { success: false, error: 'Failed to export audit logs' }
  }
}

export async function exportAnalyticsToCSV(
  userId: string,
  userRole: string
): Promise<ExportResult> {
  try {
    const profileResponse = (await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()) as { data: { role: string } | null }

    const profile = profileResponse.data

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: SysAdmin privileges required' }
    }

    // Fetch analytics data
    const { data: schools } = await supabase
      .from('schools')
      .select(`
        id,
        name,
        status,
        created_at
      `)
      .order('created_at', { ascending: false })

    const { data: users } = await supabase
      .from('user_profiles')
      .select('role, school_id')

    // Calculate metrics
    const schoolsData = (schools ?? []) as SchoolRow[]
    const totalSchools = schoolsData.length
    const activeSchools = schoolsData.filter((s) => s.status === 'active').length
    const inactiveSchools = totalSchools - activeSchools

    const usersData = (users ?? []) as UserRoleRow[]

    const usersByRole = {
      super_admin: usersData?.filter((u) => u.role === 'super_admin').length || 0,
      school_admin: usersData?.filter((u) => u.role === 'school_admin').length || 0,
      teacher: usersData?.filter((u) => u.role === 'teacher').length || 0,
      student: usersData?.filter((u) => u.role === 'student').length || 0,
      parent: usersData?.filter((u) => u.role === 'parent').length || 0,
    }

    // Generate CSV content with summary and details
    const csvRows = [
      '# Platform Analytics Summary',
      `Generated at,${new Date().toISOString()}`,
      '',
      '# School Statistics',
      'Metric,Value',
      `Total Schools,${totalSchools}`,
      `Active Schools,${activeSchools}`,
      `Inactive Schools,${inactiveSchools}`,
      '',
      '# User Statistics',
      'Role,Count',
      `SysAdmins,${usersByRole.super_admin}`,
      `School Admins,${usersByRole.school_admin}`,
      `Teachers,${usersByRole.teacher}`,
      `Students,${usersByRole.student}`,
      `Parents,${usersByRole.parent}`,
      `Total Users,${usersData.length}`,
      '',
      '# School Details',
      'ID,Name,Status,Created At',
    ]

    schoolsData?.forEach((school) => {
      csvRows.push(`${school.id},"${school.name}",${school.status},${school.created_at}`)
    })

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `analytics_export_${timestamp}.csv`

    // Log to audit trail
    await auditRpcClient.rpc('log_audit_action', {
      p_actor_user_id: userId,
      p_actor_role: userRole,
      p_action_type: 'export_csv',
      p_entity_type: 'analytics',
      p_entity_id: null,
      p_metadata: {
        export_type: 'csv',
        metrics: {
          total_schools: totalSchools,
          active_schools: activeSchools,
          total_users: usersData.length,
          users_by_role: usersByRole,
        },
        filename: filename,
      },
    })

    return {
      success: true,
      data: csvContent,
      filename: filename,
    }
  } catch (err) {
    console.error('Error in exportAnalyticsToCSV:', err)
    return { success: false, error: 'Failed to export analytics' }
  }
}
