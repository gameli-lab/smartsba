import { TeacherSidebar } from '@/components/layout/teacher-sidebar'
import { TeacherLayoutWrapper } from '@/components/layout/teacher-layout-wrapper'

interface TeacherLayoutProps {
  children: React.ReactNode
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TeacherSidebar />
      <TeacherLayoutWrapper>
        <main className="px-3 pb-6 pt-3 sm:px-4 sm:pt-4 sm:pb-8 lg:px-6 lg:pt-6 lg:pb-10">{children}</main>
      </TeacherLayoutWrapper>
    </div>
  )
}
