'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

export function SessionsFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    
    const query = params.toString()
    router.push(query ? `/school-admin/academic-sessions?${query}` : '/school-admin/academic-sessions')
  }

  const handleClear = () => {
    setSearch('')
    setStatus('')
    router.push('/school-admin/academic-sessions')
  }

  const hasFilters = search || status

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <Input
        placeholder="Search by academic year or term..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
        className="flex-1"
      />
      
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Status</SelectItem>
          <SelectItem value="current">Current</SelectItem>
          <SelectItem value="past">Past</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={handleFilter} className="w-full sm:w-auto">
        Apply
      </Button>

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={handleClear}
          className="w-full sm:w-auto text-gray-600"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
