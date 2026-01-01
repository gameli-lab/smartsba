import { ReactNode } from 'react'
import { StudentSidebar } from './student-sidebar'
import { StudentTopbar } from './student-topbar'
import { StudentLayoutWrapper } from './student-layout-wrapper'

interface StudentShellProps {
  children: ReactNode
  context: {
    fullName: string
    admissionNumber?: string | null
    className?: string | null
    academicYear?: string | null
    term?: string | null
    avatarUrl?: string | null
  }
}

export function StudentShell({ children, context }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <StudentSidebar />
      <StudentLayoutWrapper>
        <StudentTopbar context={context} />
        <main className="p-6">{children}</main>
      </StudentLayoutWrapper>
    </div>
  )
}
