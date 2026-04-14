import { ReactNode } from 'react'
import { StudentSidebar } from './student-sidebar'
import { StudentLayoutWrapper } from './student-layout-wrapper'

interface StudentShellProps {
  children: ReactNode
}

export function StudentShell({ children }: StudentShellProps) {
  return (
    <div className="student-scope min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <StudentSidebar />
      <StudentLayoutWrapper>
        <main className="p-3 sm:p-4 lg:p-6">{children}</main>
      </StudentLayoutWrapper>
    </div>
  )
}
