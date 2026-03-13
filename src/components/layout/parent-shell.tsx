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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ParentSidebar wards={wards} />
      <ParentLayoutWrapper>
        <main className="p-6">
          {children}
        </main>
      </ParentLayoutWrapper>
    </div>
  )
}
