'use server'

import { createServerComponentClient, createAdminSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import type { UserProfile } from '@/types'

/**
 * Auto-initializes a missing student profile when a student logs in for the first time.
 * This creates a basic student record with minimal required fields.
 * Uses the admin client to bypass RLS policies since this is a system initialization.
 */
export async function initializeStudentProfile() {
  try {
    const supabase = await createServerComponentClient()
    const adminSupabase = createAdminSupabaseClient()

    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      redirect('/login')
    }

    // Get user profile using regular client (user should have access to their own profile)
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    const profile = profileData as UserProfile | null

    if (profileError || !profile) {
      redirect('/login')
    }

    if (profile.role !== 'student') {
      redirect('/login')
    }

    // Check if student record already exists using admin client
    const { data: existingStudent, error: checkError } = await adminSupabase
      .from('students')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    console.log('Check existing student:', { existingStudent, checkError, userId: session.user.id })

    if (existingStudent) {
      console.log('Student already exists, returning existing data')
      return { success: true, studentExists: true, student: existingStudent }
    }

    // Student record doesn't exist, create one
    if (!profile.school_id || !profile.admission_number) {
      return {
        success: false,
        error: 'Cannot create student profile: missing school or admission number. Please contact your school administrator.',
      }
    }

    // Get today's date for admission date (fallback)
    const today = new Date().toISOString().split('T')[0]

    // Create minimal student record using admin client to bypass RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newStudent, error: createError } = await (adminSupabase as any)
      .from('students')
      .insert([
        {
          school_id: profile.school_id,
          user_id: session.user.id,
          admission_number: profile.admission_number,
          date_of_birth: profile.date_of_birth || today,
          gender: (profile.gender || 'male') as 'male' | 'female',
          admission_date: today,
          is_active: true,
        },
      ])
      .select('*')
      .single()

    if (createError) {
      console.error('Error creating student profile:', createError)
      return {
        success: false,
        error: `Failed to initialize student profile: ${createError.message}`,
      }
    }

    console.log('Student profile created successfully:', newStudent)
    return { success: true, studentExists: false, student: newStudent }
  } catch (error) {
    console.error('Error in initializeStudentProfile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}
