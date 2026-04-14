"use client"

import { ReactNode } from 'react'
import { ParentSidebar } from './parent-sidebar'
import { ParentLayoutWrapper } from './parent-layout-wrapper'

interface ParentShellProps {
  children: ReactNode
  wards: Array<{
    id: string
    name: string
    admissionNumber: string
  }>
}

export function ParentShell({ children, wards }: ParentShellProps) {
  return (
    <div className="parent-scope min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <ParentSidebar wards={wards} />
      <ParentLayoutWrapper>
        <main className="p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </ParentLayoutWrapper>
    </div>
  )
}
