"use client"

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, FileText, Activity, Megaphone, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react'

interface SidebarItem {
  href: string
  label: string
  icon: ReactNode
}

const items: SidebarItem[] = [
  { href: '/parent', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/parent/results', label: 'Ward Results', icon: <FileText className="h-5 w-5" /> },
  { href: '/parent/performance', label: 'Performance History', icon: <Activity className="h-5 w-5" /> },
  { href: '/parent/announcements', label: 'Announcements', icon: <Megaphone className="h-5 w-5" /> },
  { href: '/parent/profile', label: 'Profile', icon: <UserCircle className="h-5 w-5" /> },
]

export function ParentSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('parent-sidebar-collapsed')
    if (saved !== null) setIsCollapsed(JSON.parse(saved))
  }, [])

  const toggle = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('parent-sidebar-collapsed', JSON.stringify(next))
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-white transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && <span className="text-lg font-semibold text-gray-900">Parent</span>}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn('h-8 w-8', isCollapsed && 'mx-auto')}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <span className="shrink-0">{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
