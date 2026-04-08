"use client"

import React from 'react'
import dynamic from 'next/dynamic'

const SchoolsCountChart = dynamic(() => import('@/components/analytics/SchoolsCountChart'), { ssr: false })

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Analytics</h1>
      <div className="grid grid-cols-1 gap-6">
        <div className="card p-4">
          <SchoolsCountChart />
        </div>
      </div>
    </div>
  )
}
