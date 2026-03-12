import { TeacherLayout } from '@/components/layout/teacher-layout'
import { requireTeacher } from '@/lib/auth'

export default async function TeacherRootLayout({ children }: { children: React.ReactNode }) {
  // Auth guard – redirects to /login if not a teacher
  await requireTeacher()

  return <TeacherLayout>{children}</TeacherLayout>
}
