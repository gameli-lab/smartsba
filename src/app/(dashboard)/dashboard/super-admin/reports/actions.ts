'use server'

import { supabase } from '@/lib/supabase'
import { unstable_noStore as noStore } from 'next/cache'

export interface DateRange {
  startDate?: string
  endDate?: string
}

export interface SchoolPerformance {
  school_id: string
  school_name: string
  total_students: number
  total_teachers: number
  total_classes: number
  active_users: number
  assessment_count: number
  announcement_count: number
  status: string
}

export interface UsageTrend {
  date: string
  active_users: number
  new_schools: number
  new_users: number
  total_logins: number
}

export interface FeatureAdoption {
  feature_name: string
  schools_using: number
  total_schools: number
  adoption_rate: number
  usage_count: number
}

export async function getSchoolPerformanceReport(dateRange: DateRange = {}) {
  noStore()

  try {
    // Get all schools with aggregated metrics
    // Type assertion needed until types are regenerated
    const { data: schools, error } = await (supabase as any)
      .from('schools')
      .select(`
        id,
        name,
        status,
        created_at
      `)
      .order('name')

    if (error) throw error

    // For each school, get detailed metrics
    const performanceData: SchoolPerformance[] = await Promise.all(
      (schools || []).map(async (school: any) => {
        // Count students
        const { count: studentCount } = await (supabase as any)
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('role', 'student')

        // Count teachers
        const { count: teacherCount } = await (supabase as any)
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('role', 'teacher')

        // Count classes
        const { count: classCount } = await (supabase as any)
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)

        // Count active users (logged in within date range or last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const { count: activeUserCount } = await (supabase as any)
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('status', 'active')
          .gte('updated_at', dateRange.startDate || thirtyDaysAgo.toISOString())

        // Count assessments
        const { count: assessmentCount } = await (supabase as any)
          .from('assessments')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)

        // Count announcements
        const { count: announcementCount } = await (supabase as any)
          .from('announcements')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)

        return {
          school_id: school.id,
          school_name: school.name,
          total_students: studentCount || 0,
          total_teachers: teacherCount || 0,
          total_classes: classCount || 0,
          active_users: activeUserCount || 0,
          assessment_count: assessmentCount || 0,
          announcement_count: announcementCount || 0,
          status: school.status,
        }
      })
    )

    return {
      success: true,
      data: performanceData,
      error: null,
    }
  } catch (error) {
    console.error('Error fetching school performance report:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch report',
    }
  }
}

export async function getUsageTrendsReport(dateRange: DateRange = {}) {
  noStore()

  try {
    const endDate = dateRange.endDate || new Date().toISOString()
    const startDate = dateRange.startDate || (() => {
      const date = new Date()
      date.setDate(date.getDate() - 30)
      return date.toISOString()
    })()

    // Get daily aggregated data from audit logs
    const { data: auditData, error: auditError } = await (supabase as any)
      .from('audit_logs')
      .select('created_at, action, user_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at')

    if (auditError) throw auditError

    // Aggregate by date
    const trendsMap = new Map<string, UsageTrend>()

    // Initialize dates in range
    const current = new Date(startDate)
    const end = new Date(endDate)
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0]
      trendsMap.set(dateKey, {
        date: dateKey,
        active_users: 0,
        new_schools: 0,
        new_users: 0,
        total_logins: 0,
      })
      current.setDate(current.getDate() + 1)
    }

    // Process audit logs
    const activeUsersPerDay = new Map<string, Set<string>>()
    
    auditData?.forEach((log: any) => {
      const dateKey = log.created_at.split('T')[0]
      const trend = trendsMap.get(dateKey)
      
      if (trend) {
        if (log.action === 'login' || log.action === 'sign_in') {
          trend.total_logins++
          
          if (!activeUsersPerDay.has(dateKey)) {
            activeUsersPerDay.set(dateKey, new Set())
          }
          activeUsersPerDay.get(dateKey)?.add(log.user_id)
        }
        
        if (log.action === 'create_school') {
          trend.new_schools++
        }
        
        if (log.action === 'create_user' || log.action === 'create_admin') {
          trend.new_users++
        }
      }
    })

    // Update active user counts
    activeUsersPerDay.forEach((users, dateKey) => {
      const trend = trendsMap.get(dateKey)
      if (trend) {
        trend.active_users = users.size
      }
    })

    const trendsData = Array.from(trendsMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    )

    return {
      success: true,
      data: trendsData,
      error: null,
    }
  } catch (error) {
    console.error('Error fetching usage trends report:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch report',
    }
  }
}

export async function getFeatureAdoptionReport(dateRange: DateRange = {}) {
  noStore()

  try {
    // Get total active schools
    const { count: totalSchools } = await (supabase as any)
      .from('schools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const features: FeatureAdoption[] = []

    // Assessments feature
    const { data: assessmentSchools } = await (supabase as any)
      .from('assessments')
      .select('school_id')
      .then(({ data }: { data: any[] }) => ({
        data: [...new Set(data?.map((a: any) => a.school_id) || [])]
      }))

    const { count: assessmentCount } = await (supabase as any)
      .from('assessments')
      .select('*', { count: 'exact', head: true })

    features.push({
      feature_name: 'Assessments',
      schools_using: assessmentSchools?.length || 0,
      total_schools: totalSchools || 0,
      adoption_rate: totalSchools ? ((assessmentSchools?.length || 0) / totalSchools) * 100 : 0,
      usage_count: assessmentCount || 0,
    })

    // Announcements feature
    const { data: announcementSchools } = await (supabase as any)
      .from('announcements')
      .select('school_id')
      .then(({ data }: { data: any[] }) => ({
        data: [...new Set(data?.map((a: any) => a.school_id) || [])]
      }))

    const { count: announcementCount } = await (supabase as any)
      .from('announcements')
      .select('*', { count: 'exact', head: true })

    features.push({
      feature_name: 'Announcements',
      schools_using: announcementSchools?.length || 0,
      total_schools: totalSchools || 0,
      adoption_rate: totalSchools ? ((announcementSchools?.length || 0) / totalSchools) * 100 : 0,
      usage_count: announcementCount || 0,
    })

    // Classes feature
    const { data: classSchools } = await (supabase as any)
      .from('classes')
      .select('school_id')
      .then(({ data }: { data: any[] }) => ({
        data: [...new Set(data?.map((c: any) => c.school_id) || [])]
      }))

    const { count: classCount } = await (supabase as any)
      .from('classes')
      .select('*', { count: 'exact', head: true })

    features.push({
      feature_name: 'Classes',
      schools_using: classSchools?.length || 0,
      total_schools: totalSchools || 0,
      adoption_rate: totalSchools ? ((classSchools?.length || 0) / totalSchools) * 100 : 0,
      usage_count: classCount || 0,
    })

    // Academic Sessions feature
    const { data: sessionSchools } = await (supabase as any)
      .from('academic_sessions')
      .select('school_id')
      .then(({ data }: { data: any[] }) => ({
        data: [...new Set(data?.map((s: any) => s.school_id) || [])]
      }))

    const { count: sessionCount } = await (supabase as any)
      .from('academic_sessions')
      .select('*', { count: 'exact', head: true })

    features.push({
      feature_name: 'Academic Sessions',
      schools_using: sessionSchools?.length || 0,
      total_schools: totalSchools || 0,
      adoption_rate: totalSchools ? ((sessionSchools?.length || 0) / totalSchools) * 100 : 0,
      usage_count: sessionCount || 0,
    })

    // Subjects feature
    const { data: subjectSchools } = await (supabase as any)
      .from('subjects')
      .select('school_id')
      .then(({ data }: { data: any[] }) => ({
        data: [...new Set(data?.map((s: any) => s.school_id) || [])]
      }))

    const { count: subjectCount } = await (supabase as any)
      .from('subjects')
      .select('*', { count: 'exact', head: true })

    features.push({
      feature_name: 'Subjects',
      schools_using: subjectSchools?.length || 0,
      total_schools: totalSchools || 0,
      adoption_rate: totalSchools ? ((subjectSchools?.length || 0) / totalSchools) * 100 : 0,
      usage_count: subjectCount || 0,
    })

    return {
      success: true,
      data: features.sort((a, b) => b.adoption_rate - a.adoption_rate),
      error: null,
    }
  } catch (error) {
    console.error('Error fetching feature adoption report:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch report',
    }
  }
}

export async function getReportSummary() {
  noStore()

  try {
    const [schoolPerf, usageTrends, featureAdopt] = await Promise.all([
      getSchoolPerformanceReport(),
      getUsageTrendsReport(),
      getFeatureAdoptionReport(),
    ])

    return {
      schoolPerformance: schoolPerf.data,
      usageTrends: usageTrends.data,
      featureAdoption: featureAdopt.data,
    }
  } catch (error) {
    console.error('Error fetching report summary:', error)
    return {
      schoolPerformance: [],
      usageTrends: [],
      featureAdoption: [],
    }
  }
}
