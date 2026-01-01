"use client"

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitProfileUpdateRequest } from './actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Ward {
  student: {
    id: string
    admission_number: string
  }
  student_name: string
  class_name: string
  relationship: string
  is_primary: boolean
}

interface ProfileClientProps {
  parentName: string
  parentEmail: string
  parentPhone: string
  photoUrl: string | null
  wards: Ward[]
}

export function ProfileClient({ parentName, parentEmail, parentPhone, photoUrl, wards }: ProfileClientProps) {
  const [updateType, setUpdateType] = useState<'name' | 'phone' | 'photo' | null>(null)
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updateType || !newValue.trim() || !reason.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    const result = await submitProfileUpdateRequest(updateType, newValue, reason)

    setIsSubmitting(false)

    if (result.success) {
      setMessage({ type: 'success', text: 'Update request submitted successfully. Awaiting approval.' })
      setUpdateType(null)
      setNewValue('')
      setReason('')
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to submit request.' })
    }
  }

  const initials = parentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-6">
      {/* Parent Info */}
      <Card>
        <CardHeader>
          <CardTitle>Parent Information</CardTitle>
          <CardDescription>Your personal details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={photoUrl || undefined} />
              <AvatarFallback className="bg-purple-100 text-purple-700 text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-gray-500">Full Name</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{parentName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{parentEmail}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Phone Number</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{parentPhone}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Wards */}
      <Card>
        <CardHeader>
          <CardTitle>Linked Wards</CardTitle>
          <CardDescription>Students linked to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {wards.length === 0 ? (
            <p className="text-sm text-gray-500">No wards linked to your account.</p>
          ) : (
            <div className="space-y-3">
              {wards.map((ward) => (
                <div key={ward.student.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{ward.student_name}</p>
                      {ward.is_primary && (
                        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
                      <span>Adm. No: {ward.student.admission_number}</span>
                      <span>Class: {ward.class_name}</span>
                      <span>Relationship: {ward.relationship}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Update */}
      <Card>
        <CardHeader>
          <CardTitle>Request Profile Update</CardTitle>
          <CardDescription>Submit a request to update your profile information.</CardDescription>
        </CardHeader>
        <CardContent>
          {!updateType ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setUpdateType('name')}>
                Update Name
              </Button>
              <Button variant="outline" onClick={() => setUpdateType('phone')}>
                Update Phone
              </Button>
              <Button variant="outline" onClick={() => setUpdateType('photo')}>
                Update Photo
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="newValue">
                  New {updateType === 'name' ? 'Name' : updateType === 'phone' ? 'Phone Number' : 'Photo URL'}
                </Label>
                <Input
                  id="newValue"
                  type={updateType === 'phone' ? 'tel' : 'text'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={`Enter new ${updateType}`}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason for Update</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why you need this update"
                  className="mt-1"
                  rows={3}
                  required
                />
              </div>
              {message && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    message.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {message.text}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUpdateType(null)
                    setNewValue('')
                    setReason('')
                    setMessage(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
