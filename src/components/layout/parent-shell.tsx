"use client"

import { ReactNode } from 'react'
import { ParentSidebar } from './parent-sidebar'
import { ParentLayoutWrapper } from './parent-layout-wrapper'

interface ParentShellProps {
  children: ReactNode
}

export function ParentShell({ children }: ParentShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ParentSidebar />
      <ParentLayoutWrapper>
        <main className="p-6">
          {children}
        </main>
      </ParentLayoutWrapper>
    </div>
  )
}
