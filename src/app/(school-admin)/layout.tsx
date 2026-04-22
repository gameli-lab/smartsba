import { redirect } from 'next/navigation'
import { requireSchoolAdmin } from '@/lib/auth-guards'
import { SchoolAdminSidebar } from '@/components/layout/school-admin-sidebar'
import { SchoolAdminLayoutWrapper } from '@/components/layout/school-admin-layout-wrapper'
import { AIBubbleWrapper } from '@/components/ai/ai-bubble-wrapper'

/**
 * School Admin Dashboard Layout
 * Enforces school_admin role access.
 * Navigation (logout, profile, user menu) is handled by the persistent
 * GlobalHeader rendered in the root layout.
 */
export default async function SchoolAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let schoolAdmin
  try {
    schoolAdmin = await requireSchoolAdmin()
  } catch {
    redirect('/login')
  }

  const { profile } = schoolAdmin

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left sidebar – navigation only */}
      <SchoolAdminSidebar schoolId={profile.school_id} />

      {/* Main content area shifts right to clear the sidebar */}
      <SchoolAdminLayoutWrapper>
        <main className="p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </SchoolAdminLayoutWrapper>

      {/* AI Floating Bubble */}
      <AIBubbleWrapper schoolId={profile.school_id} />
    </div>
  )
}
