'use server'

import { supabase } from '@/lib/supabase'
import { unstable_noStore as noStore } from 'next/cache'

export interface EmailLog {
  id: string
  recipient_email: string
  recipient_user_id: string | null
  email_type: string
  subject: string
  body_html: string
  body_text: string
  status: 'pending' | 'sent' | 'failed' | 'bounced'
  error_message: string | null
  metadata: Record<string, any>
  sent_at: string | null
  created_at: string
}

export interface GetEmailLogsParams {
  search?: string
  emailType?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
  cursor?: string
}

export async function getEmailLogs(params: GetEmailLogsParams = {}) {
  noStore()
  
  const {
    search = '',
    emailType,
    status,
    startDate,
    endDate,
    limit = 50,
    cursor,
  } = params

  try {
    let query = supabase
      .from('email_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (search) {
      query = query.or(`recipient_email.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    if (emailType) {
      query = query.eq('email_type', emailType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Cursor-based pagination
    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching email logs:', error)
      return {
        logs: [],
        count: 0,
        nextCursor: null,
      }
    }

    const nextCursor = data && data.length === limit 
      ? (data as any[])[data.length - 1].created_at 
      : null

    return {
      logs: data as EmailLog[] || [],
      count: count || 0,
      nextCursor,
    }
  } catch (error) {
    console.error('Email logs fetch error:', error)
    return {
      logs: [],
      count: 0,
      nextCursor: null,
    }
  }
}

export async function getEmailStats() {
  noStore()

  try {
    // Get total counts by status
    const { data: statusCounts } = await supabase
      .from('email_logs')
      .select('status')
      .then(({ data }: { data: any }) => {
        const counts = {
          total: data?.length || 0,
          sent: data?.filter((log: any) => log.status === 'sent').length || 0,
          pending: data?.filter((log: any) => log.status === 'pending').length || 0,
          failed: data?.filter((log: any) => log.status === 'failed').length || 0,
          bounced: data?.filter((log: any) => log.status === 'bounced').length || 0,
        }
        return { data: counts }
      })

    // Get today's email count
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { count: todayCount } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // Get this week's email count
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    weekAgo.setHours(0, 0, 0, 0)
    
    const { count: weekCount } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString())

    return {
      ...statusCounts,
      todayCount: todayCount || 0,
      weekCount: weekCount || 0,
    }
  } catch (error) {
    console.error('Email stats fetch error:', error)
    return {
      total: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      bounced: 0,
      todayCount: 0,
      weekCount: 0,
    }
  }
}
