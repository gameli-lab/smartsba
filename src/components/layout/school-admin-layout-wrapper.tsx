"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function SchoolAdminLayoutWrapper({ children }: LayoutWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Sync with sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('school-admin-sidebar-collapsed')
      if (saved !== null) {
        setIsCollapsed(JSON.parse(saved))
      }
    }

    // Initial check
    checkSidebarState()

    // Listen for storage changes
    window.addEventListener('storage', checkSidebarState)

    // Poll for changes (since localStorage events don't fire in the same window)
    const interval = setInterval(checkSidebarState, 100)

    return () => {
      window.removeEventListener('storage', checkSidebarState)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className={cn(
      "transition-all duration-300",
      isCollapsed ? "pl-16" : "pl-64"
    )}>
      {children}
    </div>
  )
}
