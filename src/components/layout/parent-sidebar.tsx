"use client"

import { useEffect, useState, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutDashboard, FileText, Activity, Megaphone, UserCircle, Menu, X } from 'lucide-react'

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

interface ParentSidebarProps {
  wards: Array<{
    id: string
    name: string
    admissionNumber: string
  }>
}

export function ParentSidebar({ wards }: ParentSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const selectedWardId = searchParams.get('ward')
  const effectiveWardId = selectedWardId || wards[0]?.id

  const withWard = (href: string) => {
    if (!effectiveWardId || href.includes('/parent/profile')) return href
    return `${href}?ward=${encodeURIComponent(effectiveWardId)}`
  }

  const onWardChange = (wardId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('ward', wardId)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

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
          <span className="text-lg font-semibold text-gray-900">Parent</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {wards.length > 0 && (
          <div className="border-b p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Selected Ward</p>
            <Select value={effectiveWardId} onValueChange={onWardChange}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {wards.map((ward) => (
                  <SelectItem key={ward.id} value={ward.id}>
                    {ward.name} ({ward.admissionNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={withWard(item.href)}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'
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
