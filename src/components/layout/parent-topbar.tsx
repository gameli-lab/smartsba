"use client"

import { useState, useEffect } from 'react'
import { Bell, UserCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Ward {
  student_id: string
  student_name: string
  admission_number: string
  class_name: string | null
  is_primary: boolean
}

interface ParentTopbarProps {
  parentName: string
  parentEmail: string
  wards: Ward[]
  currentSession: { academic_year: string; term: number } | null
  selectedWardId: string | null
  onWardChange: (wardId: string) => void
}

export function ParentTopbar({
  parentName,
  parentEmail,
  wards,
  currentSession,
  selectedWardId,
  onWardChange,
}: ParentTopbarProps) {
  const [showShadow, setShowShadow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowShadow(window.scrollY > 4)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const initials = parentName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between bg-white px-6 transition-shadow',
        showShadow && 'shadow-sm'
      )}
    >
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500">Parent Portal</span>
          <span className="text-lg font-semibold text-gray-900">{parentName}</span>
        </div>

        {wards.length > 0 && (
          <div className="flex items-center gap-3 border-l pl-6">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Viewing Ward</span>
              {wards.length === 1 ? (
                <div className="text-sm font-medium text-gray-900">
                  {wards[0].student_name}
                  <span className="ml-2 text-xs text-gray-500">({wards[0].admission_number})</span>
                </div>
              ) : (
                <Select value={selectedWardId || ''} onValueChange={onWardChange}>
                  <SelectTrigger className="h-8 w-[280px] text-sm">
                    <SelectValue placeholder="Select ward" />
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((ward) => (
                      <SelectItem key={ward.student_id} value={ward.student_id}>
                        <div className="flex items-center gap-2">
                          <span>{ward.student_name}</span>
                          <span className="text-xs text-gray-500">({ward.admission_number})</span>
                          {ward.class_name && <span className="text-xs text-gray-500">• {ward.class_name}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        {currentSession && (
          <div className="flex flex-col border-l pl-6">
            <span className="text-xs text-gray-500">Academic Session</span>
            <span className="text-sm font-medium text-gray-900">
              {currentSession.academic_year} • Term {currentSession.term}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5 text-gray-600" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={parentName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-gray-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{parentName}</p>
                <p className="text-xs leading-none text-gray-500">{parentEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserCircle className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>Change Password</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
