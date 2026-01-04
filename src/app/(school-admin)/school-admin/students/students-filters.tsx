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
import type { Class } from '@/types'

interface Props {
  classes: Class[]
}

export function StudentsFilters({ classes }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [classId, setClassId] = useState(searchParams.get('classId') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (classId) params.set('classId', classId)
    if (status) params.set('status', status)
    
    const query = params.toString()
    router.push(query ? `/school-admin/students?${query}` : '/school-admin/students')
  }

  const handleClear = () => {
    setSearch('')
    setClassId('')
    setStatus('')
    router.push('/school-admin/students')
  }

  const hasFilters = search || classId || status

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <Input
        placeholder="Search by name or admission number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
        className="flex-1"
      />
      
      <Select value={classId} onValueChange={setClassId}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Filter by class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Classes</SelectItem>
          {classes.map((cls) => (
            <SelectItem key={cls.id} value={cls.id}>
              {cls.name} {cls.stream ? `(${cls.stream})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
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
