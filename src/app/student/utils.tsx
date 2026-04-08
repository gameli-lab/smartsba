/**
 * Shared utilities for student pages
 */

import { requireStudent } from '@/lib/auth'
import { initializeStudentProfile } from './actions'

/**
 * Enhanced version of requireStudent that auto-initializes missing student profiles
 */
export async function requireStudentWithAutoInit() {
  let guard = await requireStudent()

  console.log('Initial guard check:', { hasStudent: !!guard.student, profileRole: guard.profile.role })

  if (!guard.student) {
    // Attempt to auto-initialize the student profile
    console.log('Student profile missing, attempting auto-initialization...')
    const initResult = await initializeStudentProfile()
    
    console.log('Initialization result:', initResult)
    
    if (!initResult.success) {
      return { success: false, error: initResult.error, guard: null }
    }

    // If initialization created a new student, use that data directly
    // to avoid RLS timing issues
    if (initResult.student) {
      console.log('Using newly created student data directly')
      guard = {
        ...guard,
        student: initResult.student,
      }
    } else {
      // Student already existed, refetch to get the data
      console.log('Student existed, refetching...')
      guard = await requireStudent()
      
      if (!guard.student) {
        console.error('Failed to refetch student after initialization')
        return {
          success: false,
          error: 'Your student profile was initialized, but is not yet available. Please refresh the page.',
          guard: null,
        }
      }
    }
  }

  console.log('Final guard state:', { hasStudent: !!guard.student, studentId: guard.student?.id })
  return { success: true, error: null, guard }
}

export function renderStudentProfileError(error: string) {
  return (
    <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
      <h1 className="text-lg font-semibold">Student Profile Error</h1>
      <p className="mt-2 text-sm">{error || 'Unable to access your student profile. Please contact your school administrator.'}</p>
    </div>
  )
}
