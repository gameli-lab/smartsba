"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  LayoutDashboard,
  School,
  CalendarDays,
  Award,
  Users,
  UserCog,
  GraduationCap,
  BookOpen,
  Shapes,
  ClipboardList,
  FileText,
  BarChart3,
  Megaphone,
  UserCircle,
  Shield,
  Settings,
  LogOut,
} from 'lucide-react'
import { AuthService } from '@/lib/auth'

interface SidebarProps {
  schoolId: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface NavSection {
  label: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/school-admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { href: '/school-admin/analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" /> },
      { href: '/school-admin/announcements', label: 'Announcements', icon: <Megaphone className="h-5 w-5" /> },
    ],
  },
  {
    label: 'School Management',
    items: [
      { href: '/school-admin/school-profile', label: 'School Profile', icon: <School className="h-5 w-5" /> },
      { href: '/school-admin/security', label: 'Security & Access', icon: <Shield className="h-5 w-5" /> },
      { href: '/school-admin/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
    ],
  },
  {
    label: 'Academics',
    items: [
      { href: '/school-admin/academic-sessions', label: 'Academic Sessions & Terms', icon: <CalendarDays className="h-5 w-5" /> },
      { href: '/school-admin/grading-promotion', label: 'Grading & Promotion', icon: <Award className="h-5 w-5" /> },
      { href: '/school-admin/classes', label: 'Classes', icon: <BookOpen className="h-5 w-5" /> },
      { href: '/school-admin/subjects', label: 'Subjects', icon: <Shapes className="h-5 w-5" /> },
      { href: '/school-admin/scores-assessments', label: 'Scores & Assessments', icon: <ClipboardList className="h-5 w-5" /> },
      { href: '/school-admin/reports', label: 'Reports', icon: <FileText className="h-5 w-5" /> },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/school-admin/teachers', label: 'Teacher Management', icon: <Users className="h-5 w-5" /> },
      { href: '/school-admin/teacher-assignments', label: 'Teacher Assignments', icon: <UserCog className="h-5 w-5" /> },
      { href: '/school-admin/students', label: 'Student Management', icon: <GraduationCap className="h-5 w-5" /> },
      { href: '/school-admin/parents', label: 'Parents & Guardians', icon: <UserCircle className="h-5 w-5" /> },
    ],
  },
]

const primaryMobileItems: NavItem[] = [
  { href: '/school-admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/school-admin/students', label: 'Students', icon: <GraduationCap className="h-5 w-5" /> },
  { href: '/school-admin/teachers', label: 'Teachers', icon: <Users className="h-5 w-5" /> },
  { href: '/school-admin/classes', label: 'Classes', icon: <BookOpen className="h-5 w-5" /> },
]

const overflowMobileItems = sections
  .flatMap((section) => section.items)
  .filter((item) => !primaryMobileItems.some((primary) => primary.href === item.href))

export function SchoolAdminSidebar({ schoolId }: SidebarProps) {
  void schoolId
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const pathname = usePathname()
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

  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <aside
        className={cn(
          'group fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-20 flex-col border-r bg-white transition-[width] duration-200 hover:w-64 md:flex dark:border-gray-800 dark:bg-gray-950'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b px-2 group-hover:justify-start group-hover:px-4">
          <div className="shrink-0 rounded-md bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <School className="h-5 w-5" />
          </div>
          <span className="ml-3 hidden text-sm font-semibold text-gray-900 group-hover:inline dark:text-gray-100">
            School Admin
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-3 pb-4">
            {sections.map((section) => (
              <div key={section.label} className="space-y-1">
                <div className="px-2 py-1">
                  <p className="hidden text-xs font-semibold uppercase tracking-wider text-gray-500 group-hover:block dark:text-gray-400">
                    {section.label}
                  </p>
                  <div className="mx-auto h-px w-8 bg-gray-200 group-hover:hidden dark:bg-gray-800" />
                </div>
                {section.items.map((item) => (
                  <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} isActive={isActivePath(item.href)} />
                ))}
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t p-2">
          <Button variant="ghost" className="w-full justify-center px-2 text-red-600 group-hover:justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="ml-2 hidden text-sm font-medium group-hover:inline">Logout</span>
          </Button>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {primaryMobileItems.map((item) => {
            const active = isActivePath(item.href)
            return (
              <Link key={item.href} href={item.href} className={cn('flex flex-col items-center justify-center rounded-md px-1 py-2 text-[11px] font-medium', active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400')}>
                <span>{item.icon}</span>
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            )
          })}
          <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto flex-col gap-1 rounded-md px-1 py-2 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                <Settings className="h-5 w-5" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mb-2 w-64">
              {overflowMobileItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild onClick={() => setIsMoreOpen(false)}>
                  <Link href={item.href} className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}

interface SidebarItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive: boolean
}

function SidebarItem({ href, icon, label, isActive }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-colors group-hover:justify-start dark:text-gray-300',
        "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        isActive && "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
      )}
      title={label}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden text-sm font-medium group-hover:inline">{label}</span>
    </Link>
  )
}
