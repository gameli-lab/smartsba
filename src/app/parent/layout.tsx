import { ReactNode } from 'react'
import { ParentShell } from '@/components/layout/parent-shell'
import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default async function ParentRootLayout({ children }: { children: ReactNode }) {
  const { profile, wards } = await requireParent()

  // Fetch current session
  const { data: sessionData } = await supabase
    .from('academic_sessions')
    .select('academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const currentSession = sessionData as { academic_year: string; term: number } | null

  // Build wards data with class names
  const wardsWithClasses = await Promise.all(
    wards.map(async (ward) => {
      let className: string | null = null
      if (ward.student.class_id) {
        const { data: classData } = await supabase
          .from('classes')
          .select('name, stream')
          .eq('id', ward.student.class_id)
          .maybeSingle()

        if (classData) {
          const klass = classData as { name: string; stream?: string | null }
          className = klass.stream ? `${klass.name} - ${klass.stream}` : klass.name
        }
      }

      return {
        student_id: ward.student.id,
        student_name: ward.student.user_id, // TODO: fetch full_name from user_profiles
        admission_number: ward.student.admission_number,
        class_name: className,
        is_primary: ward.is_primary,
      }
    })
  )

  // Fetch student names from user_profiles
  const studentUserIds = wards.map((w) => w.student.user_id)
  const { data: profilesData } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', studentUserIds)

  const profilesMap = new Map(
    (profilesData || []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name])
  )

  // Update ward names
  const wardsFormatted = wardsWithClasses.map((ward, idx) => ({
    ...ward,
    student_name: profilesMap.get(wards[idx].student.user_id) || 'Unknown Student',
  }))

  // Default to primary ward or first ward
  const defaultWard = wardsFormatted.find((w) => w.is_primary) || wardsFormatted[0] || null

  return (
    <ParentShell
      parentName={profile.full_name}
      parentEmail={profile.email}
      wards={wardsFormatted}
      currentSession={currentSession}
      defaultWardId={defaultWard?.student_id || null}
    >
      {children}
    </ParentShell>
  )
}
