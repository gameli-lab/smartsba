"use client"

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, User, KeyRound, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'

interface TeacherTopbarProps {
  teacherName: string
  teacherEmail: string
  role: 'class_teacher' | 'subject_teacher'
  currentSession?: { academic_year: string; term: number } | null
}

export function TeacherTopbar({ teacherName, teacherEmail, role, currentSession }: TeacherTopbarProps) {
  const router = useRouter()
  const roleLabel = role === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'

  const initials = teacherName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = async () => {
    await AuthService.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleProfile = () => {
    router.push('/teacher/profile')
  }

  const handleChangePassword = () => {
    router.push('/auth/change-password')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm text-gray-600">Welcome</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">{teacherName}</span>
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                {roleLabel}
              </Badge>
            </div>
            {currentSession ? (
              <p className="text-xs text-gray-500">
                {currentSession.academic_year} • Term {currentSession.term}
              </p>
            ) : (
              <p className="text-xs text-gray-400">Current session not set</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="Notifications">
            <Bell className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" alt={teacherName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{teacherName}</p>
                  <p className="text-xs leading-none text-gray-500">{teacherEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfile}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleChangePassword}>
                <KeyRound className="mr-2 h-4 w-4" />
                <span>Change Password</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
