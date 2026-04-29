'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

interface AssumeRolePreviewBadgeProps {
  assumedRole: string
  expiresAt?: number
  className?: string
}

function formatRemainingTime(millisecondsRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(millisecondsRemaining / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function AssumeRolePreviewBadge({ assumedRole, expiresAt, className }: AssumeRolePreviewBadgeProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!expiresAt) return undefined

    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [expiresAt])

  const roleLabel = assumedRole.replace(/_/g, ' ').toUpperCase()

  if (!expiresAt) {
    return (
      <Badge variant="outline" className={`border-0 bg-amber-50 text-amber-700 ${className || ''}`.trim()}>
        PREVIEW AS {roleLabel}
      </Badge>
    )
  }

  const millisecondsRemaining = Math.max(0, expiresAt - now)
  const isExpired = millisecondsRemaining === 0
  const isUrgent = !isExpired && millisecondsRemaining <= 5 * 60 * 1000
  const toneClass = isExpired
    ? 'bg-gray-100 text-gray-500'
    : isUrgent
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <Badge
      variant="outline"
      className={`border-0 ${toneClass} ${className || ''}`.trim()}
      aria-label={`Previewing as ${roleLabel}. ${isExpired ? 'Session expired' : `${formatRemainingTime(millisecondsRemaining)} remaining`}`}
    >
      PREVIEW AS {roleLabel}
      <span className="ml-2 font-medium">
        {isExpired ? 'EXPIRED' : `${formatRemainingTime(millisecondsRemaining)} left`}
      </span>
    </Badge>
  )
}
