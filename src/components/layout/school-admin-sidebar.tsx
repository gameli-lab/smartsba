"use client"

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Menu,
  X,
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

export function SchoolAdminSidebar({ schoolId }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      await AuthService.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <>
      {/* Hamburger Button */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-50"
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white transition-all duration-300 transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-lg font-semibold text-gray-900">
            School Admin
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

      {/* Sidebar Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* 1. Dashboard */}
        <SidebarItem
          href="/school-admin"
          icon={<LayoutDashboard className="h-5 w-5" />}
          label="Dashboard"
          
          isActive={pathname === '/school-admin'}
        />

        {/* 2. School Management */}
        <SidebarSection
          label="School Management"
          
        >
          <SidebarItem
            href="/school-admin/school-profile"
            icon={<School className="h-5 w-5" />}
            label="School Profile"
            
            isActive={pathname === '/school-admin/school-profile'}
          />
        </SidebarSection>

        {/* 3. Academic Management */}
        <SidebarSection
          label="Academic Management"
          
        >
          <SidebarItem
            href="/school-admin/academic-sessions"
            icon={<CalendarDays className="h-5 w-5" />}
            label="Academic Sessions & Terms"
            
            isActive={pathname === '/school-admin/academic-sessions'}
          />
          <SidebarItem
            href="/school-admin/grading-promotion"
            icon={<Award className="h-5 w-5" />}
            label="Grading & Promotion"
            
            isActive={pathname === '/school-admin/grading-promotion'}
          />
        </SidebarSection>

        {/* 4. Teachers */}
        <SidebarSection
          label="Teachers"
          
        >
          <SidebarItem
            href="/school-admin/teachers"
            icon={<Users className="h-5 w-5" />}
            label="Teacher Management"
            
            isActive={pathname === '/school-admin/teachers'}
          />
          <SidebarItem
            href="/school-admin/teacher-assignments"
            icon={<UserCog className="h-5 w-5" />}
            label="Teacher Assignments"
            
            isActive={pathname === '/school-admin/teacher-assignments'}
          />
        </SidebarSection>

        {/* 5. Students */}
        <SidebarSection
          label="Students"
          
        >
          <SidebarItem
            href="/school-admin/students"
            icon={<GraduationCap className="h-5 w-5" />}
            label="Student Management"
            
            isActive={pathname === '/school-admin/students'}
          />
        </SidebarSection>

        {/* 6. Classes & Subjects */}
        <SidebarSection
          label="Classes & Subjects"
          
        >
          <SidebarItem
            href="/school-admin/classes"
            icon={<BookOpen className="h-5 w-5" />}
            label="Classes"
            
            isActive={pathname === '/school-admin/classes'}
          />
          <SidebarItem
            href="/school-admin/subjects"
            icon={<Shapes className="h-5 w-5" />}
            label="Subjects"
            
            isActive={pathname === '/school-admin/subjects'}
          />
        </SidebarSection>

        {/* 7. Assessments & Results */}
        <SidebarSection
          label="Assessments & Results"
          
        >
          <SidebarItem
            href="/school-admin/scores-assessments"
            icon={<ClipboardList className="h-5 w-5" />}
            label="Scores & Assessments"
            
            isActive={pathname === '/school-admin/scores-assessments'}
          />
          <SidebarItem
            href="/school-admin/reports"
            icon={<FileText className="h-5 w-5" />}
            label="Reports"
            
            isActive={pathname === '/school-admin/reports'}
          />
        </SidebarSection>

        {/* 8. Analytics */}
        <SidebarItem
          href="/school-admin/analytics"
          icon={<BarChart3 className="h-5 w-5" />}
          label="Analytics"
          
          isActive={pathname === '/school-admin/analytics'}
        />

        {/* 9. Announcements */}
        <SidebarItem
          href="/school-admin/announcements"
          icon={<Megaphone className="h-5 w-5" />}
          label="Announcements"
          
          isActive={pathname === '/school-admin/announcements'}
        />

        {/* 10. Parents & Guardians */}
        <SidebarItem
          href="/school-admin/parents"
          icon={<UserCircle className="h-5 w-5" />}
          label="Parents & Guardians"
          
          isActive={pathname === '/school-admin/parents'}
        />

        {/* 11. Security & Access */}
        <SidebarItem
          href="/school-admin/security"
          icon={<Shield className="h-5 w-5" />}
          label="Security & Access"
          
          isActive={pathname === '/school-admin/security'}
        />

        {/* 12. Settings */}
        <SidebarItem
          href="/school-admin/settings"
          icon={<Settings className="h-5 w-5" />}
          label="Settings"
          
          isActive={pathname === '/school-admin/settings'}
        />
      </nav>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      </aside>
    </>
  )
}

interface SidebarSectionProps {
  label: string
  children: React.ReactNode
}

function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div className="space-y-1">
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </h3>
      </div>
      {children}
    </div>
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-colors",
        "hover:bg-gray-100 hover:text-gray-900",
        isActive && "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
      )}
      title={label}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
