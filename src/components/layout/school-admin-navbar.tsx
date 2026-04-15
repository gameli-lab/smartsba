"use client"

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, User, KeyRound, LogOut, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/lib/auth'
import Image from 'next/image'
import Link from 'next/link'

interface NavbarProps {
  schoolName: string
  schoolLogoUrl?: string | null
  currentSession?: {
    academic_year: string
    term: number
  } | null
  userName: string
  userEmail: string
}

export function SchoolAdminNavbar({
  schoolName,
  schoolLogoUrl,
  currentSession,
  userName,
  userEmail,
}: NavbarProps) {
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

  const handleProfile = () => {
    router.push('/profile')
  }

  const handleChangePassword = () => {
    // TODO: Navigate to change password page in later stages
    console.log('Navigate to change password')
  }

  // Get user initials for avatar fallback
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="fixed top-0 z-30 w-full border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: School Info - Clickable to go to dashboard */}
        <Link href="/school-admin" className="flex items-center gap-3 hover:opacity-75 transition-opacity">
          {schoolLogoUrl && (
            <div className="relative h-10 w-10">
              <Image
                src={schoolLogoUrl}
                alt={schoolName}
                fill
                className="object-contain"
              />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{schoolName}</h1>
            {currentSession && (
              <p className="text-xs text-gray-500">
                {currentSession.academic_year} • Term {currentSession.term}
              </p>
            )}
          </div>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Dashboard Home Button */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Go to Dashboard"
          >
            <Link href="/school-admin">
              <Home className="h-5 w-5" />
            </Link>
          </Button>

          {/* Notifications - Placeholder */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {/* TODO: Add notification badge in later stages */}
          </Button>

          {/* Logout Button (Direct) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" alt={userName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-gray-500">
                    {userEmail}
                  </p>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
