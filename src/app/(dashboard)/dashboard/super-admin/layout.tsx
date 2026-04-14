import { requireSuperAdmin } from '@/lib/auth'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSuperAdmin()
  return <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">{children}</div>
}
