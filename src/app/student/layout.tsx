import { ReactNode } from 'react'
import { StudentShell } from '@/components/layout/student-shell'
import { requireStudent } from '@/lib/auth-guards'

export default async function StudentRootLayout({ children }: { children: ReactNode }) {
  // Auth guard – redirects to /login if not a student
  await requireStudent()

  return <StudentShell>{children}</StudentShell>
}
