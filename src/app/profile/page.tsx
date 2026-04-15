import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/supabase'
import { ProfileEditor } from '@/components/profile/profile-editor'

export default async function ProfilePage() {
  const supabase = await createServerComponentClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, full_name, email, phone, address, photo_url, staff_id, admission_number, school_id, gender, date_of_birth')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    redirect('/login')
  }

  const typedProfile = profile as {
    role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent'
    full_name: string
    email: string
    phone: string | null
    address: string | null
    photo_url: string | null
    staff_id?: string | null
    admission_number?: string | null
    school_id?: string | null
    gender?: string | null
    date_of_birth?: string | null
  }

  const metadata = [
    { label: 'Role', value: typedProfile.role.replace(/_/g, ' ') },
    { label: 'Staff ID', value: typedProfile.staff_id },
    { label: 'Admission Number', value: typedProfile.admission_number },
    { label: 'School ID', value: typedProfile.school_id },
    { label: 'Gender', value: typedProfile.gender },
    { label: 'Date of Birth', value: typedProfile.date_of_birth },
  ].filter((item) => Boolean(item.value))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <ProfileEditor
        roleLabel={typedProfile.role.replace(/_/g, ' ').toUpperCase()}
        fullName={typedProfile.full_name}
        email={typedProfile.email}
        phone={typedProfile.phone || ''}
        address={typedProfile.address || ''}
        photoUrl={typedProfile.photo_url}
        metadata={metadata}
      />
    </div>
  )
}
