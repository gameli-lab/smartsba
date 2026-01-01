"use client"

import { ReactNode, useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ParentSidebar } from './parent-sidebar'
import { ParentTopbar } from './parent-topbar'
import { ParentLayoutWrapper } from './parent-layout-wrapper'

interface Ward {
  student_id: string
  student_name: string
  admission_number: string
  class_name: string | null
  is_primary: boolean
}

interface ParentShellProps {
  children: ReactNode
  parentName: string
  parentEmail: string
  wards: Ward[]
  currentSession: { academic_year: string; term: number } | null
  defaultWardId: string | null
}

export function ParentShell({ children, parentName, parentEmail, wards, currentSession, defaultWardId }: ParentShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const wardIdFromUrl = searchParams.get('ward')
  
  const [selectedWardId, setSelectedWardId] = useState<string | null>(
    wardIdFromUrl || defaultWardId
  )

  useEffect(() => {
    // Sync URL with selected ward
    if (selectedWardId && selectedWardId !== wardIdFromUrl) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('ward', selectedWardId)
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [selectedWardId, wardIdFromUrl, pathname, router, searchParams])

  useEffect(() => {
    // Update selection when URL changes
    if (wardIdFromUrl && wards.some(w => w.student_id === wardIdFromUrl)) {
      setSelectedWardId(wardIdFromUrl)
    } else if (!wardIdFromUrl && defaultWardId) {
      setSelectedWardId(defaultWardId)
    }
  }, [wardIdFromUrl, wards, defaultWardId])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ParentSidebar />
      <ParentLayoutWrapper>
        <ParentTopbar
          parentName={parentName}
          parentEmail={parentEmail}
          wards={wards}
          currentSession={currentSession}
          selectedWardId={selectedWardId}
          onWardChange={setSelectedWardId}
        />
        <main className="p-6">
          {children}
        </main>
      </ParentLayoutWrapper>
    </div>
  )
}
