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

export function SubjectsFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [type, setType] = useState(searchParams.get('type') || '')

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (type && type !== 'all') params.set('type', type)
    
    const query = params.toString()
    router.push(query ? `/school-admin/subjects?${query}` : '/school-admin/subjects')
  }

  const handleClear = () => {
    setSearch('')
    setType('')
    router.push('/school-admin/subjects')
  }

  const hasFilters = search || type

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <Input
        placeholder="Search by subject name or code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
        className="flex-1"
      />
      
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="core">Core</SelectItem>
          <SelectItem value="elective">Elective</SelectItem>
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
