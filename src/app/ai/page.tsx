import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/supabase'
import { AICommandCenter } from '@/components/ai/ai-command-center'
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

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">SmartSBA AI Governance Assistant</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Role context switching, feature checklist generation, and security assessment starter.
        </p>
      </div>
      <AICommandCenter initialRole={typedProfile.role} />
    </div>
  )
}
