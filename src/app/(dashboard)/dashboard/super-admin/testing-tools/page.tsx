import { requireSuperAdmin } from '@/lib/auth-guards'
import { DummyDataGeneratorPanel } from '@/components/super-admin/dummy-data-generator-panel'
import { RoleAssumptionPanel } from '@/components/super-admin/role-assumption-panel'

export default async function SuperAdminTestingToolsPage() {
  await requireSuperAdmin()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Testing Tools</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Session-scoped role preview and sandbox data generation for end-to-end validation.
        </p>
      </div>

      <RoleAssumptionPanel />
      <DummyDataGeneratorPanel />
    </div>
  )
}
