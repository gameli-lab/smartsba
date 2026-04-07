"use client"

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { submitProfileUpdateRequest } from './actions'
import { useRouter } from 'next/navigation'

interface ProfileClientProps {
  student: {
    id: string
    admission_number: string
    class_name: string | null
    full_name: string
    email: string
    phone: string | null
    address: string | null
    date_of_birth: string
    gender: string
  }
}

export function ProfileClient({ student }: ProfileClientProps) {
  const router = useRouter()
  const [isRequestingChange, setIsRequestingChange] = useState(false)
  const [requestType, setRequestType] = useState<'name' | 'photo' | null>(null)
  const [formData, setFormData] = useState({
    requestedName: '',
    reason: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmitRequest = async () => {
    if (!requestType) return

    setLoading(true)
    setMessage(null)

    try {
      const result = await submitProfileUpdateRequest({
        studentId: student.id,
        requestType,
        requestedValue: requestType === 'name' ? formData.requestedName : 'photo_update',
        reason: formData.reason,
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Your request has been submitted for approval.' })
        setFormData({ requestedName: '', reason: '' })
        setRequestType(null)
        setIsRequestingChange(false)
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to submit request.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const initials = student.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Your profile picture.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src="" alt={student.full_name} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              onClick={() => {
                setRequestType('photo')
                setIsRequestingChange(true)
              }}
            >
              Request Photo Update
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your profile details. Request changes if information is incorrect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium text-gray-600">Full Name</Label>
              <p className="text-sm text-gray-900 mt-1">{student.full_name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Admission Number</Label>
              <p className="text-sm text-gray-900 mt-1">{student.admission_number}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Class</Label>
              <p className="text-sm text-gray-900 mt-1">{student.class_name || 'Not assigned'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Email</Label>
              <p className="text-sm text-gray-900 mt-1">{student.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Phone</Label>
              <p className="text-sm text-gray-900 mt-1">{student.phone || 'Not provided'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Date of Birth</Label>
              <p className="text-sm text-gray-900 mt-1">
                {new Date(student.date_of_birth).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Gender</Label>
              <p className="text-sm text-gray-900 mt-1 capitalize">{student.gender}</p>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm font-medium text-gray-600">Address</Label>
              <p className="text-sm text-gray-900 mt-1">{student.address || 'Not provided'}</p>
            </div>
          </div>
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setRequestType('name')
                setIsRequestingChange(true)
              }}
            >
              Request Name Correction
            </Button>
          </div>
        </CardContent>
      </Card>

      {isRequestingChange && requestType && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Request Profile Update</CardTitle>
            <CardDescription>
              {requestType === 'name'
                ? 'Submit a request to correct your name. This will be reviewed by your class teacher or school admin.'
                : 'Submit a request to update your profile photo. This will be reviewed by your class teacher or school admin.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requestType === 'name' && (
              <div>
                <Label htmlFor="requestedName">Correct Name</Label>
                <Input
                  id="requestedName"
                  value={formData.requestedName}
                  onChange={(e) => setFormData({ ...formData, requestedName: e.target.value })}
                  placeholder="Enter the correct name"
                  className="bg-white"
                />
              </div>
            )}
            <div>
              <Label htmlFor="reason">Reason for Change</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Explain why this change is needed"
                rows={3}
                className="bg-white"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSubmitRequest} disabled={loading || (requestType === 'name' && !formData.requestedName) || !formData.reason}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRequestingChange(false)
                  setRequestType(null)
                  setFormData({ requestedName: '', reason: '' })
                  setMessage(null)
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
