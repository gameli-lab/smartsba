import { ReactNode } from 'react'
import { ParentShell } from '@/components/layout/parent-shell'
import { requireParent } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'

export default async function ParentRootLayout({ children }: { children: ReactNode }) {
  // Auth guard – redirects to /login if not a parent
  const { wards } = await requireParent()

  const supabase = await createServerComponentClient()
  const wardUserIds = wards.map((w) => w.student.user_id)

  let namesMap = new Map<string, string>()
  if (wardUserIds.length > 0) {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', wardUserIds)

    namesMap = new Map((data || []).map((row) => [row.user_id, row.full_name || 'Ward']))
  }

  const wardOptions = wards.map((w) => ({
    id: w.student.id,
    name: namesMap.get(w.student.user_id) || 'Ward',
    admissionNumber: w.student.admission_number,
  }))

  return <ParentShell wards={wardOptions}>{children}</ParentShell>
}
