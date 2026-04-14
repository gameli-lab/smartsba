"use client"

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutDashboard, FileText, Activity, Megaphone, UserCircle } from 'lucide-react'

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
  const [isMoreOpen, setIsMoreOpen] = useState(false)

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

  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const primaryItems = items.slice(0, 4)
  const overflowItems = items.slice(4)

  return (
    <>
      <aside
        className={cn(
          'group fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-20 flex-col border-r bg-white transition-[width] duration-200 hover:w-64 md:flex dark:border-gray-800 dark:bg-gray-950'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b px-2 group-hover:justify-start group-hover:px-4">
          <div className="shrink-0 rounded-md bg-purple-100 p-2 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
            <UserCircle className="h-5 w-5" />
          </div>
          <span className="ml-3 hidden text-sm font-semibold text-gray-900 group-hover:inline dark:text-gray-100">Parent</span>
        </div>

        {wards.length > 0 && (
          <div className="border-b p-2">
            <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-gray-500 group-hover:block">Selected Ward</p>
            <Select value={effectiveWardId} onValueChange={onWardChange}>
              <SelectTrigger className="h-9 w-full text-sm group-hover:w-full">
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
            const active = isActivePath(item.href)
            return (
              <Link key={item.href} href={withWard(item.href)}>
                <div
                  className={cn(
                    'flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors group-hover:justify-start',
                    active ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  )}
                  title={item.label}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="hidden group-hover:inline">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {primaryItems.map((item) => {
            const active = isActivePath(item.href)
            return (
              <Link key={item.href} href={withWard(item.href)} className={cn('flex flex-col items-center justify-center rounded-md px-1 py-2 text-[11px] font-medium', active ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400')}>
                <span>{item.icon}</span>
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            )
          })}
          <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto flex-col gap-1 rounded-md px-1 py-2 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                <UserCircle className="h-5 w-5" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mb-2 w-64">
              {overflowItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild onClick={() => setIsMoreOpen(false)}>
                  <Link href={withWard(item.href)} className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}
