"use client"

import { useEffect, useState, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, FileText, Activity, Megaphone, UserCircle, Menu, X } from 'lucide-react'

interface SidebarItem {
  href: string
  label: string
  icon: ReactNode
}

const items: SidebarItem[] = [
  { href: '/student', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/student/results', label: 'Results', icon: <FileText className="h-5 w-5" /> },
  { href: '/student/performance', label: 'Performance History', icon: <Activity className="h-5 w-5" /> },
  { href: '/student/announcements', label: 'Announcements', icon: <Megaphone className="h-5 w-5" /> },
  { href: '/student/downloads', label: 'Downloads', icon: <FileText className="h-5 w-5" /> },
  { href: '/student/profile', label: 'Profile', icon: <UserCircle className="h-5 w-5" /> },
]

export function StudentSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

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
          'fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white transition-all duration-300 transform',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-lg font-semibold text-gray-900">Student</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
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
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
