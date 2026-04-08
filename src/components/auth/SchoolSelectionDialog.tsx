'use client'

import { useState } from 'react'
import { SchoolOption } from '@/lib/auth'

interface SchoolSelectionDialogProps {
  schools: SchoolOption[]
  onSelect: (schoolId: string) => void
  isLoading?: boolean
}

export function SchoolSelectionDialog({ schools, onSelect, isLoading = false }: SchoolSelectionDialogProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSchoolId) {
      onSelect(selectedSchoolId)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">Select Your School</h2>
        <p className="text-gray-600 text-sm mb-6">Your identifier is associated with multiple schools. Please select the school you want to login to:</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {schools.map((school) => (
              <label key={school.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="school"
                  value={school.id}
                  checked={selectedSchoolId === school.id}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">{school.name}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={!selectedSchoolId || isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Loading...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
