'use server'

import { revalidatePath } from 'next/cache'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { createServerComponentClient } from '@/lib/supabase'
import { AcademicSession, AcademicTerm } from '@/types'

interface CreateAcademicSessionInput {
  academic_year: string
  term: AcademicTerm
  start_date: string
  end_date: string
  vacation_date?: string
  reopening_date?: string
  isCurrent?: boolean
}

interface UpdateAcademicSessionInput extends CreateAcademicSessionInput {
  id: string
}

/**
 * Create a new academic session
 */
export async function createAcademicSession(input: CreateAcademicSessionInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    // Validate inputs
    if (!input.academic_year || !input.term || !input.start_date || !input.end_date) {
      return { success: false, error: 'All required fields must be filled' }
    }

    // Validate term is 1, 2, or 3
    if (![1, 2, 3].includes(input.term)) {
      return { success: false, error: 'Term must be 1, 2, or 3' }
    }

    // Validate dates
    const startDate = new Date(input.start_date)
    const endDate = new Date(input.end_date)

    if (startDate >= endDate) {
      return { success: false, error: 'End date must be after start date' }
    }

    if (input.vacation_date) {
      const vacationDate = new Date(input.vacation_date)
      if (vacationDate < startDate || vacationDate > endDate) {
        return { success: false, error: 'Vacation date must be within term dates' }
      }
    }

    // Check for duplicate session (same year and term)
    const { data: existing } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('academic_year', input.academic_year)
      .eq('term', input.term)
      .single()

    if (existing) {
      return { success: false, error: `Session for ${input.academic_year} Term ${input.term} already exists` }
    }

    // If setting as current, first unset all other current sessions
    if (input.isCurrent) {
      const { error: unsetError } = await supabase
        .from('academic_sessions')
        .update({ is_current: false })
        .eq('school_id', schoolId)
        .eq('is_current', true)

      if (unsetError) {
        console.error('Error unsetting current sessions:', unsetError)
        return { success: false, error: `Failed to unset previous current session: ${unsetError.message}` }
      }
    }

    // Create session
    const { error } = await supabase
      .from('academic_sessions')
      .insert({
        school_id: schoolId,
        academic_year: input.academic_year,
        term: input.term,
        start_date: input.start_date,
        end_date: input.end_date,
        vacation_date: input.vacation_date || null,
        reopening_date: input.reopening_date || null,
        is_current: input.isCurrent ?? false,
      })

    if (error) {
      console.error('Error creating academic session:', error)
      return { success: false, error: 'Failed to create academic session' }
    }

    revalidatePath('/school-admin/academic-sessions')
    return { success: true }
  } catch (error) {
    console.error('Error in createAcademicSession:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update an existing academic session
 */
export async function updateAcademicSession(input: UpdateAcademicSessionInput) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    // Validate inputs
    if (!input.id || !input.academic_year || !input.term || !input.start_date || !input.end_date) {
      return { success: false, error: 'All required fields must be filled' }
    }

    // Validate dates
    const startDate = new Date(input.start_date)
    const endDate = new Date(input.end_date)

    if (startDate >= endDate) {
      return { success: false, error: 'End date must be after start date' }
    }

    if (input.vacation_date) {
      const vacationDate = new Date(input.vacation_date)
      if (vacationDate < startDate || vacationDate > endDate) {
        return { success: false, error: 'Vacation date must be within term dates' }
      }
    }

    // Verify ownership
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id, school_id')
      .eq('id', input.id)
      .single()

    const typedSession = session as Pick<AcademicSession, 'id' | 'school_id'> | null

    if (!typedSession || typedSession.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    // Update session
    const { error } = await supabase
      .from('academic_sessions')
      .update({
        academic_year: input.academic_year,
        term: input.term,
        start_date: input.start_date,
        end_date: input.end_date,
        vacation_date: input.vacation_date || null,
        reopening_date: input.reopening_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)

    if (error) {
      console.error('Error updating academic session:', error)
      return { success: false, error: 'Failed to update academic session' }
    }

    revalidatePath('/school-admin/academic-sessions')
    return { success: true }
  } catch (error) {
    console.error('Error in updateAcademicSession:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Set a session as current (and unset others)
 */
export async function setCurrentSession(sessionId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    // Verify ownership
    // Verify ownership
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id, school_id, is_current')
      .eq('id', sessionId)
      .single()

    const typedSession = session as Pick<AcademicSession, 'id' | 'school_id'> & { is_current: boolean } | null

    if (!typedSession || typedSession.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    // If already current, no need to update
    if (typedSession.is_current) {
      return { success: true }
    }

    // Unset all current sessions for this school
    const { error: unsetError } = await supabase
      .from('academic_sessions')
      .update({ is_current: false })
      .eq('school_id', schoolId)
      .eq('is_current', true)

    if (unsetError) {
      console.error('Error unsetting current sessions:', unsetError)
      return { success: false, error: `Failed to unset previous current session: ${unsetError.message}` }
    }

    // Set the selected session as current
    const { error: setError } = await supabase
      .from('academic_sessions')
      .update({ is_current: true, updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (setError) {
      console.error('Error setting current session:', setError)
      return { success: false, error: 'Failed to set current session' }
    }

    revalidatePath('/school-admin/academic-sessions')
    revalidatePath('/school-admin')
    return { success: true }
  } catch (error) {
    console.error('Error in setCurrentSession:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete an academic session
 */
export async function deleteAcademicSession(sessionId: string) {
  try {
    const { profile } = await requireSchoolAdmin()
    const schoolId = profile.school_id
    const supabase = await createServerComponentClient()

    // Verify ownership
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id, school_id, is_current')
      .eq('id', sessionId)
      .single()

    const typedSession = session as Pick<AcademicSession, 'id' | 'school_id' | 'is_current'> | null

    if (!typedSession || typedSession.school_id !== schoolId) {
      return { success: false, error: 'Session not found' }
    }

    // Prevent deletion of current session
    if (typedSession.is_current) {
      return { success: false, error: 'Cannot delete the current active session' }
    }

    // TODO: Check if session has associated data (scores, reports, etc.)
    // For now, we allow deletion

    const { error } = await supabase
      .from('academic_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) {
      console.error('Error deleting academic session:', error)
      return { success: false, error: 'Failed to delete academic session' }
    }

    revalidatePath('/school-admin/academic-sessions')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteAcademicSession:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
