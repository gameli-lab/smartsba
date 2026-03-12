import { redirect } from 'next/navigation'
import { requireParent } from '@/lib/auth'

export default async function ParentDashboardRedirect() {
  await requireParent()
  redirect('/parent')
}
