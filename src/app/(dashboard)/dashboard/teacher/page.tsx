import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'

export default async function TeacherDashboardRedirect() {
  await requireTeacher()
  redirect('/teacher/dashboard')
}
