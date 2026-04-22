import { redirect } from 'next/navigation'
import { requireParent } from '@/lib/auth-guards'

export default async function ParentDashboardRedirect() {
  await requireParent()
  redirect('/parent')
}
