"use client"

import { useEffect, useState } from 'react'
import { Bell, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface StudentContext {
  fullName: string
  admissionNumber?: string | null
  className?: string | null
  academicYear?: string | null
  term?: string | null
  avatarUrl?: string | null
}

export function StudentTopbar({ context }: { context: StudentContext }) {
  const [showShadow, setShowShadow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowShadow(window.scrollY > 4)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const initials =
    context.fullName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST'

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between bg-white px-6 transition-shadow',
        showShadow && 'shadow-sm'
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm text-gray-500">Welcome back</span>
        <div className="flex items-center gap-3 text-lg font-semibold text-gray-900">
          {context.fullName}
          {context.admissionNumber && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {context.admissionNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {context.className && <span>{context.className}</span>}
          {context.academicYear && (
            <span className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-gray-300" />
              <span>{context.academicYear}</span>
            </span>
          )}
          {context.term && (
            <span className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-gray-300" />
              <span>{context.term}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5 text-gray-600" />
        </Button>
        <div className="flex items-center gap-3 rounded-full border px-3 py-1">
          <Avatar className="h-8 w-8">
            {context.avatarUrl ? <AvatarImage src={context.avatarUrl} alt={context.fullName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="text-sm font-medium text-gray-900">{context.fullName}</div>
            {context.term ? (
              <div className="text-xs text-gray-500">{context.term}</div>
            ) : (
              <div className="text-xs text-gray-500">Student</div>
            )}
          </div>
          <Button variant="ghost" size="icon" aria-label="Profile">
            <UserCircle className="h-5 w-5 text-gray-600" />
          </Button>
        </div>
      </div>
    </header>
  )
}
