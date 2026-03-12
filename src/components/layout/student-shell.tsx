import { ReactNode } from 'react'
import { StudentSidebar } from './student-sidebar'
import { StudentLayoutWrapper } from './student-layout-wrapper'

interface StudentShellProps {
  children: ReactNode
}

export function StudentShell({ children }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <StudentSidebar />
      <StudentLayoutWrapper>
        <main className="p-6">{children}</main>
      </StudentLayoutWrapper>
    </div>
  )
}
