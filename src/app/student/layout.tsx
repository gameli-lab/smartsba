import { ReactNode } from 'react'
import { StudentShell } from '@/components/layout/student-shell'
import { requireStudent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default async function StudentRootLayout({ children }: { children: ReactNode }) {
  const { profile, student } = await requireStudent()

  const { data: sessionData } = await supabase
    .from('academic_sessions')
    .select('academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  const currentSession = sessionData as { academic_year: string; term: number } | null

  let className: string | null = null

  if (student?.class_id) {
    const { data: classRow } = await supabase
      .from('classes')
      .select('name, stream')
      .eq('id', student.class_id)
      .maybeSingle()

    if (classRow) {
      const { name, stream } = classRow as { name: string; stream?: string | null }
      className = stream ? `${name} - ${stream}` : name
    }
  }

  const termLabel = currentSession?.term ? `Term ${currentSession.term}` : null

  return (
    <StudentShell
      context={{
        fullName: profile.full_name,
        admissionNumber: profile.admission_number,
        className,
        academicYear: currentSession?.academic_year ?? null,
        term: termLabel,
        avatarUrl: null,
      }}
    >
      {children}
    </StudentShell>
  )
}
