import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/supabase'
import type { UserRole } from '@/types'

interface ProfileRow {
  role: UserRole
}

export default async function AIPage() {
  const supabase = await createServerComponentClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (error || !profile) {
    redirect('/login')
  }

  const typedProfile = profile as ProfileRow

  if (typedProfile.role === 'super_admin') {
    redirect('/dashboard/super-admin/ai')
  }

  if (typedProfile.role === 'school_admin') {
    redirect('/school-admin')
  }

  redirect('/dashboard')
}
