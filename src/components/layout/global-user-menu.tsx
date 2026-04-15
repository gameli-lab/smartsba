'use client'

import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bot, KeyRound, LogOut, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'

function getProfileLink(userRole?: string): string | null {
  return userRole ? '/profile' : null
}

function getAIAssistantLink(userRole?: string): string {
  switch (userRole) {
    case 'super_admin':
      return '/dashboard/super-admin/ai'
    case 'school_admin':
      return '/school-admin'
    default:
      return '/ai'
  }
}

interface GlobalUserMenuProps {
  userName: string
  userEmail: string
  userRole?: string
  assumedRole?: string
}

export function GlobalUserMenu({ userName, userEmail, userRole, assumedRole }: GlobalUserMenuProps) {
  const router = useRouter()
  const [isAssumeActive, setIsAssumeActive] = useState(false)
  const [isClearingAssume, setIsClearingAssume] = useState(false)

  useEffect(() => {
    if (userRole !== 'super_admin') {
      setIsAssumeActive(false)
      return
    }

    void (async () => {
      try {
        const response = await fetch('/api/super-admin/assume-role', { cache: 'no-store' })
        const payload = (await response.json()) as { active?: boolean }
        setIsAssumeActive(Boolean(payload.active))
      } catch {
        setIsAssumeActive(false)
      }
    })()
  }, [userRole])

  const handleLogout = async () => {
    try {
      await AuthService.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleReturnToSysAdmin = async () => {
    setIsClearingAssume(true)
    try {
      const response = await fetch('/api/super-admin/assume-role', { method: 'DELETE' })
      const payload = (await response.json()) as { success?: boolean }
      if (!response.ok || !payload.success) {
        throw new Error('Failed to clear assumption')
      }
      setIsAssumeActive(false)
      router.push('/dashboard/super-admin')
      router.refresh()
    } catch (error) {
      console.error('Failed to clear assumed role:', error)
    } finally {
      setIsClearingAssume(false)
    }
  }

  const profileLink = getProfileLink(userRole)
  const aiAssistantLink = getAIAssistantLink(userRole)

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-gray-500">{userEmail}</p>
            {userRole && (
              <p className="text-xs text-gray-400 capitalize mt-1">
                {userRole.replace(/_/g, ' ')}
              </p>
            )}
            {assumedRole ? (
              <p className="text-xs mt-1 text-amber-600">Previewing as {assumedRole.replace(/_/g, ' ')}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileLink ? (
          <DropdownMenuItem onClick={() => router.push(profileLink)} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="text-xs text-gray-500">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push(aiAssistantLink)} className="cursor-pointer">
          <Bot className="mr-2 h-4 w-4" />
          <span>AI Assistant</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/mfa-challenge')} className="cursor-pointer">
          <KeyRound className="mr-2 h-4 w-4" />
          <span>MFA Security</span>
        </DropdownMenuItem>
        {isAssumeActive ? (
          <DropdownMenuItem onClick={handleReturnToSysAdmin} className="cursor-pointer" disabled={isClearingAssume}>
            <User className="mr-2 h-4 w-4" />
            <span>{isClearingAssume ? 'Returning...' : 'Return to SysAdmin'}</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
