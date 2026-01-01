"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight,
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
} from 'lucide-react'

interface SidebarProps {
  schoolId: string
}

export function SchoolAdminSidebar({ schoolId }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('school-admin-sidebar-collapsed')
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved))
    }
  }, [])

  // Save sidebar state to localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('school-admin-sidebar-collapsed', JSON.stringify(newState))
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-white transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Sidebar Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <span className="text-lg font-semibold text-gray-900">
            School Admin
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("h-8 w-8", isCollapsed && "mx-auto")}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* 1. Dashboard */}
        <SidebarItem
          href="/school-admin"
          icon={<LayoutDashboard className="h-5 w-5" />}
          label="Dashboard"
          isCollapsed={isCollapsed}
          isActive={pathname === '/school-admin'}
        />

        {/* 2. School Management */}
        <SidebarSection
          label="School Management"
          isCollapsed={isCollapsed}
        >
          <SidebarItem
            href="/school-admin/school-profile"
            icon={<School className="h-5 w-5" />}
            label="School Profile"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/school-profile'}
          />
        </SidebarSection>

        {/* 3. Academic Management */}
        <SidebarSection
          label="Academic Management"
          isCollapsed={isCollapsed}
        >
          <SidebarItem
            href="/school-admin/academic-sessions"
            icon={<CalendarDays className="h-5 w-5" />}
            label="Academic Sessions & Terms"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/academic-sessions'}
          />
          <SidebarItem
            href="/school-admin/grading-promotion"
            icon={<Award className="h-5 w-5" />}
            label="Grading & Promotion"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/grading-promotion'}
          />
        </SidebarSection>

        {/* 4. Teachers */}
        <SidebarSection
          label="Teachers"
          isCollapsed={isCollapsed}
        >
          <SidebarItem
            href="/school-admin/teachers"
            icon={<Users className="h-5 w-5" />}
            label="Teacher Management"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/teachers'}
          />
          <SidebarItem
            href="/school-admin/teacher-assignments"
            icon={<UserCog className="h-5 w-5" />}
            label="Teacher Assignments"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/teacher-assignments'}
          />
        </SidebarSection>

        {/* 5. Students */}
        <SidebarSection
          label="Students"
          isCollapsed={isCollapsed}
        >
          <SidebarItem
            href="/school-admin/students"
            icon={<GraduationCap className="h-5 w-5" />}
            label="Student Management"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/students'}
          />
        </SidebarSection>

        {/* 6. Classes & Subjects */}
        <SidebarSection
          label="Classes & Subjects"
          isCollapsed={isCollapsed}
        >
          <SidebarItem
            href="/school-admin/classes"
            icon={<BookOpen className="h-5 w-5" />}
            label="Classes"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/classes'}
          />
          <SidebarItem
            href="/school-admin/subjects"
            icon={<Shapes className="h-5 w-5" />}
            label="Subjects"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/subjects'}
          />
        </SidebarSection>

        {/* 7. Assessments & Results */}
        <SidebarSection
          label="Assessments & Results"
          isCollapsed={isCollapsed}
        >
          <SidebarItem
            href="/school-admin/scores-assessments"
            icon={<ClipboardList className="h-5 w-5" />}
            label="Scores & Assessments"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/scores-assessments'}
          />
          <SidebarItem
            href="/school-admin/reports"
            icon={<FileText className="h-5 w-5" />}
            label="Reports"
            isCollapsed={isCollapsed}
            isActive={pathname === '/school-admin/reports'}
          />
        </SidebarSection>

        {/* 8. Analytics */}
        <SidebarItem
          href="/school-admin/analytics"
          icon={<BarChart3 className="h-5 w-5" />}
          label="Analytics"
          isCollapsed={isCollapsed}
          isActive={pathname === '/school-admin/analytics'}
        />

        {/* 9. Announcements */}
        <SidebarItem
          href="/school-admin/announcements"
          icon={<Megaphone className="h-5 w-5" />}
          label="Announcements"
          isCollapsed={isCollapsed}
          isActive={pathname === '/school-admin/announcements'}
        />

        {/* 10. Parents & Guardians */}
        <SidebarItem
          href="/school-admin/parents"
          icon={<UserCircle className="h-5 w-5" />}
          label="Parents & Guardians"
          isCollapsed={isCollapsed}
          isActive={pathname === '/school-admin/parents'}
        />

        {/* 11. Security & Access */}
        <SidebarItem
          href="/school-admin/security"
          icon={<Shield className="h-5 w-5" />}
          label="Security & Access"
          isCollapsed={isCollapsed}
          isActive={pathname === '/school-admin/security'}
        />

        {/* 12. Settings */}
        <SidebarItem
          href="/school-admin/settings"
          icon={<Settings className="h-5 w-5" />}
          label="Settings"
          isCollapsed={isCollapsed}
          isActive={pathname === '/school-admin/settings'}
        />
      </nav>
    </aside>
  )
}

interface SidebarSectionProps {
  label: string
  isCollapsed: boolean
  children: React.ReactNode
}

function SidebarSection({ label, isCollapsed, children }: SidebarSectionProps) {
  if (isCollapsed) {
    // In collapsed mode, just render items without section header
    return <>{children}</>
  }

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
  isCollapsed: boolean
  isActive: boolean
}

function SidebarItem({ href, icon, label, isCollapsed, isActive }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-colors",
        "hover:bg-gray-100 hover:text-gray-900",
        isActive && "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800",
        isCollapsed && "justify-center"
      )}
      title={isCollapsed ? label : undefined}
    >
      {icon}
      {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )
}
