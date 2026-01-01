import { requireSchoolAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { SecurityClient } from './security-client'
import { UserProfile } from '@/types'
import { fetchLoginActivity } from './actions'

export default async function SecurityPage() {
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const { data: userRows } = await supabase
    .from('user_profiles')
    .select('id, user_id, full_name, email, role, status')
    .eq('school_id', schoolId)
    .in('role', ['school_admin', 'teacher', 'student', 'parent'])
    .order('full_name', { ascending: true })

  const users = (userRows as Pick<UserProfile, 'id' | 'user_id' | 'full_name' | 'email' | 'role' | 'status'>[] | null) || []
  const loginActivity = await fetchLoginActivity(users.map((u) => u.user_id).filter(Boolean))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Security & Access</h1>
        <p className="text-gray-600">Manage user access and view basic activity.</p>
      </div>

      <SecurityClient users={users} loginActivity={loginActivity} />
    </div>
  )
}
