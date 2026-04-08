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
import type { Class, Subject } from '@/types'

interface Props {
  classes: Class[]
  subjects: Subject[]
}

export function TeachersFilters({ classes, subjects }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [classId, setClassId] = useState(searchParams.get('classId') || '')
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '')

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status && status !== 'all') params.set('status', status)
    if (classId && classId !== 'all') params.set('classId', classId)
    if (subjectId && subjectId !== 'all') params.set('subjectId', subjectId)
    
    const query = params.toString()
    router.push(query ? `/school-admin/teachers?${query}` : '/school-admin/teachers')
  }

  const handleClear = () => {
    setSearch('')
    setStatus('')
    setClassId('')
    setSubjectId('')
    router.push('/school-admin/teachers')
  }

  const hasFilters = search || status || classId || subjectId

  return (
    <div className="flex flex-col lg:flex-row gap-3 mb-6">
      <Input
        placeholder="Search by name or staff ID..."
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
          <SelectItem value="all">All Classes</SelectItem>
          {classes.map((cls) => (
            <SelectItem key={cls.id} value={cls.id}>
              {cls.name}{cls.stream ? ` (${cls.stream})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={subjectId} onValueChange={setSubjectId}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Filter by subject" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Subjects</SelectItem>
          {subjects.map((subj) => (
            <SelectItem key={subj.id} value={subj.id}>
              {subj.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
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
