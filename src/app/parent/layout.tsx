import { ReactNode } from 'react'
import { ParentShell } from '@/components/layout/parent-shell'
import { requireParent } from '@/lib/auth'

export default async function ParentRootLayout({ children }: { children: ReactNode }) {
  // Auth guard – redirects to /login if not a parent
  await requireParent()

  return <ParentShell>{children}</ParentShell>
}
