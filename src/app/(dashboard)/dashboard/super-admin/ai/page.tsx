import { requireSuperAdmin } from '@/lib/auth'
import { SuperAdminAIHub } from '@/components/ai/super-admin-ai-hub'

export default async function SuperAdminAIPage() {
  await requireSuperAdmin()

  return (
    <div className="space-y-6">
      <SuperAdminAIHub />
    </div>
  )
}
