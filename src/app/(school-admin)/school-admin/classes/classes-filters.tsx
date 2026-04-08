'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LEVEL_GROUPS, getLevelGroupsInOrder } from '@/lib/constants/level-groups'

export function ClassesFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [level, setLevel] = useState(searchParams.get('level') || '')
  const [stream, setStream] = useState(searchParams.get('stream') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (level) params.set('level', level)
    if (stream) params.set('stream', stream)
    if (status) params.set('status', status)
    
    const query = params.toString()
    router.push(query ? `/school-admin/classes?${query}` : '/school-admin/classes')
  }

  const handleClear = () => {
    setSearch('')
    setLevel('')
    setStream('')
    setStatus('')
    router.push('/school-admin/classes')
  }

  const hasFilters = search || level || stream || status

  return (
    <div className="space-y-3 mb-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger>
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {getLevelGroupsInOrder().map((groupKey) => {
              const group = LEVEL_GROUPS[groupKey]
              return (
                <SelectItem key={groupKey} value={groupKey.toLowerCase()}>
                  {group.label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Select value={stream} onValueChange={setStream}>
          <SelectTrigger>
            <SelectValue placeholder="Stream" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">A</SelectItem>
            <SelectItem value="B">B</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search class name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleFilter} className="w-full sm:w-auto">
          Apply Filters
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
    </div>
  )
}
