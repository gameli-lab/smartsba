"use client"

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function TeacherLayoutWrapper({ children }: LayoutWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem('teacher-sidebar-collapsed')
      if (saved !== null) {
        setIsCollapsed(JSON.parse(saved))
      }
    }

    sync()
    window.addEventListener('storage', sync)
    const interval = setInterval(sync, 100)

    return () => {
      window.removeEventListener('storage', sync)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className={cn('transition-all duration-300', isCollapsed ? 'pl-16' : 'pl-64')}>
      {children}
    </div>
  )
}
