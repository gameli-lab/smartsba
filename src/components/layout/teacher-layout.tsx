import { TeacherSidebar } from '@/components/layout/teacher-sidebar'
import { TeacherLayoutWrapper } from '@/components/layout/teacher-layout-wrapper'
import { TeacherTopbar } from '@/components/layout/teacher-topbar'

interface TeacherLayoutProps {
  children: React.ReactNode
  teacherName: string
  teacherEmail: string
  role: 'class_teacher' | 'subject_teacher'
  currentSession?: { academic_year: string; term: number } | null
}

export function TeacherLayout({ children, teacherName, teacherEmail, role, currentSession }: TeacherLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherSidebar />
      <TeacherLayoutWrapper>
        <TeacherTopbar
          teacherName={teacherName}
          teacherEmail={teacherEmail}
          role={role}
          currentSession={currentSession}
        />
        <main className="pt-16 px-6 pb-10">{children}</main>
      </TeacherLayoutWrapper>
    </div>
  )
}
