import { redirect } from 'next/navigation'
import { requireSchoolAdmin } from '@/lib/auth'
import { createServerComponentClient } from '@/lib/supabase'
import { SchoolAdminSidebar } from '@/components/layout/school-admin-sidebar'
import { SchoolAdminNavbar } from '@/components/layout/school-admin-navbar'
import { SchoolAdminLayoutWrapper } from '@/components/layout/school-admin-layout-wrapper'
import { School, AcademicSession } from '@/types'

/**
 * School Admin Dashboard Layout
 * This layout wraps all school admin pages and enforces role-based access
 */
export default async function SchoolAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforce school admin access - this guard will throw an error if:
  // 1. User is not authenticated
  // 2. User role is not school_admin
  // 3. User is not associated with a school
  let schoolAdmin
  try {
    schoolAdmin = await requireSchoolAdmin()
  } catch (error) {
    // Redirect to login if not authenticated or not authorized
    redirect('/login')
  }

  const { profile } = schoolAdmin

  const supabase = await createServerComponentClient()

  // Fetch minimal school data for the navbar
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, logo_url')
    .eq('id', profile.school_id)
    .single()

  const typedSchool = school as School | null

  // Fetch current academic session for the navbar
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('academic_year, term')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .single()

  const typedSession = currentSession as Pick<AcademicSession, 'academic_year' | 'term'> | null

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Sidebar */}
      <SchoolAdminSidebar schoolId={profile.school_id} />

      {/* Main Content Area with dynamic padding */}
      <SchoolAdminLayoutWrapper>
        {/* Top Navbar */}
        <SchoolAdminNavbar
          schoolName={typedSchool?.name || 'School'}
          schoolLogoUrl={typedSchool?.logo_url}
          currentSession={typedSession}
          userName={profile.full_name}
          userEmail={profile.email}
        />

        {/* Page Content */}
        <main className="pt-16">
          {children}
        </main>
      </SchoolAdminLayoutWrapper>
    </div>
  )
}
