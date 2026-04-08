'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { archiveClass, reactivateClass } from './actions'

interface Props {
  classId: string
  status: 'active' | 'archived'
}

export function ClassStatusManager({ classId, status }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleArchive = () => {
    setError(null)
    startTransition(async () => {
      const result = await archiveClass(classId)
      if (!result.success) {
        setError(result.error || 'Failed to archive class')
        return
      }
      router.refresh()
    })
  }

  const handleReactivate = () => {
    setError(null)
    startTransition(async () => {
      const result = await reactivateClass(classId)
      if (!result.success) {
        setError(result.error || 'Failed to reactivate class')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Class Status:</span>
        <span className={`text-sm font-semibold ${status === 'active' ? 'text-green-700' : 'text-gray-700'}`}>
          {status === 'active' ? 'Active' : 'Archived'}
        </span>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={isPending}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            {isPending ? 'Archiving...' : 'Archive Class'}
          </Button>
        )}

        {status === 'archived' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReactivate}
            disabled={isPending}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            {isPending ? 'Reactivating...' : 'Reactivate Class'}
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {status === 'active'
          ? 'Archive this class to prevent new enrollments while preserving historical data.'
          : 'Reactivate this class to allow new enrollments.'}
      </p>
    </div>
  )
}
