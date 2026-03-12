import { TeacherSidebar } from '@/components/layout/teacher-sidebar'
import { TeacherLayoutWrapper } from '@/components/layout/teacher-layout-wrapper'

interface TeacherLayoutProps {
  children: React.ReactNode
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherSidebar />
      <TeacherLayoutWrapper>
        <main className="px-6 pb-10 pt-6">{children}</main>
      </TeacherLayoutWrapper>
    </div>
  )
}
