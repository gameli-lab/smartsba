import { redirect } from 'next/navigation'
import { requireStudent } from '@/lib/auth-guards'

export default async function StudentDashboardRedirect() {
  await requireStudent()
  redirect('/student')
}
