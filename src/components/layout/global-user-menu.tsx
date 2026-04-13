'use client'

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
import { Bot, LogOut, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'

function getProfileLink(userRole?: string): string | null {
  switch (userRole) {
    case 'school_admin': return '/school-admin/school-profile'
    case 'teacher':      return '/teacher/profile'
    case 'student':      return '/student/profile'
    case 'parent':       return '/parent/profile'
    default:             return null
  }
}

interface GlobalUserMenuProps {
  userName: string
  userEmail: string
  userRole?: string
}

export function GlobalUserMenu({ userName, userEmail, userRole }: GlobalUserMenuProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await AuthService.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const profileLink = getProfileLink(userRole)

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
        <DropdownMenuItem onClick={() => router.push('/ai')} className="cursor-pointer">
          <Bot className="mr-2 h-4 w-4" />
          <span>AI Assistant</span>
        </DropdownMenuItem>
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
