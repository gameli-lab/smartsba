'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ProfileEditorProps = {
  roleLabel: string
  fullName: string
  email: string
  phone: string
  address: string
  photoUrl?: string | null
  metadata?: Array<{ label: string; value: string | null | undefined }>
}

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProfileEditor({
  roleLabel,
  fullName,
  email,
  phone,
  address,
  photoUrl,
  metadata = [],
}: ProfileEditorProps) {
  const router = useRouter()
  const [formFullName, setFormFullName] = useState(fullName)
  const [formPhone, setFormPhone] = useState(phone)
  const [formAddress, setFormAddress] = useState(address)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const avatarSrc = useMemo(() => {
    if (!photoUrl) return null
    return `/api/profile/avatar?path=${encodeURIComponent(photoUrl)}`
  }, [photoUrl])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formFullName,
          phone: formPhone,
          address: formAddress,
        }),
      })

      const payload = (await response.json()) as { success?: boolean; error?: string }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to update profile')
      }

      setMessage({ type: 'success', text: 'Profile updated successfully.' })
      router.refresh()
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : 'Failed to update profile' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json()) as { success?: boolean; error?: string }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to upload avatar')
      }

      setMessage({ type: 'success', text: 'Profile picture updated successfully.' })
      router.refresh()
    } catch (uploadError) {
      setMessage({ type: 'error', text: uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar' })
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const initials = initialsFromName(fullName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Profile</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Edit your profile details and profile picture.</p>
        </div>
        <Badge variant="outline">{roleLabel}</Badge>
      </div>

      {message ? (
        <div className={`rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a current profile picture for all portals.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarSrc || undefined} alt={fullName} />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label htmlFor="profile-avatar" className="cursor-pointer">
              <Button type="button" variant="outline" disabled={isUploading} asChild>
                <span>{isUploading ? 'Uploading...' : 'Upload Picture'}</span>
              </Button>
            </Label>
            <input
              id="profile-avatar"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500">PNG, JPG, WebP, or GIF up to 5MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your core account details. Email remains read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input id="full-name" value={formFullName} onChange={(e) => setFormFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} readOnly disabled className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} rows={3} placeholder="Optional" />
              </div>
            </div>

            {metadata.length > 0 ? (
              <div className="grid gap-3 rounded-lg border bg-gray-50 p-4 text-sm md:grid-cols-2">
                {metadata.map((item) => (
                  <div key={item.label}>
                    <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                    <p className="font-medium text-gray-900">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
