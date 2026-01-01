import { TeacherLayout } from '@/components/layout/teacher-layout'
import { supabase } from '@/lib/supabase'
import { requireTeacher } from '@/lib/auth'

export default async function TeacherRootLayout({ children }: { children: React.ReactNode }) {
  const { profile, effectiveRole } = await requireTeacher()

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id, academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  return (
    <TeacherLayout
      teacherName={profile.full_name}
      teacherEmail={profile.email}
      role={effectiveRole}
      currentSession={currentSession || null}
    >
      {children}
    </TeacherLayout>
  )
}
