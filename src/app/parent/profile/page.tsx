import { requireParent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ProfileClient } from '@/components/parent/profile-client'

export default async function ParentProfilePage() {
  const { user, wards } = await requireParent()

  // Get parent's full profile
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('full_name, photo_url')
    .eq('user_id', user.id)
    .maybeSingle()

  const parentProfile = profileData as { full_name: string | null; photo_url: string | null } | null

  // Get parent's email from auth
  const email = user.email || 'N/A'

  // Get parent record for contact_phone
  const { data: parentData } = await supabase
    .from('parents')
    .select('contact_phone')
    .eq('user_id', user.id)
    .maybeSingle()

  const parentPhone = (parentData as { contact_phone: string | null } | null)?.contact_phone || 'N/A'

  // Enrich wards with student names and class names
  const wardsWithNames = await Promise.all(
    wards.map(async (ward) => {
      const [{ data: studentProfile }, { data: classData }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('full_name')
          .eq('user_id', ward.student.user_id)
          .maybeSingle(),
        supabase
          .from('classes')
          .select('name')
          .eq('id', ward.student.class_id)
          .maybeSingle(),
      ])

      return {
        ...ward,
        student_name: (studentProfile as { full_name: string } | null)?.full_name || 'Unknown',
        class_name: (classData as { name: string } | null)?.name || 'N/A',
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-600">View and manage your profile information.</p>
      </div>

      <ProfileClient
        parentName={parentProfile?.full_name || 'N/A'}
        parentEmail={email}
        parentPhone={parentPhone}
        photoUrl={parentProfile?.photo_url || null}
        wards={wardsWithNames}
      />
    </div>
  )
}
