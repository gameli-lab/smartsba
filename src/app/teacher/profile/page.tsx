import { requireTeacher } from '@/lib/auth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

const submitRequestAction = async (formData: FormData) => {
  'use server'
  // TODO: wire to school admin approval flow
  console.log('Profile update request submitted', Object.fromEntries(formData.entries()))
}

export default async function TeacherProfilePage() {
  const { profile, effectiveRole } = await requireTeacher()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-600">View your information and request updates.</p>
        </div>
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          {effectiveRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Read-only profile details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500">Full Name</p>
            <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="text-sm font-medium text-gray-900">{profile.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Staff ID</p>
            <p className="text-sm font-medium text-gray-900">{profile.staff_id || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Phone</p>
            <p className="text-sm font-medium text-gray-900">{profile.phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm font-medium text-gray-900">{profile.address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Gender</p>
            <p className="text-sm font-medium text-gray-900">{profile.gender || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Profile Update</CardTitle>
          <CardDescription>Submit changes for School Admin approval (name/photo/other).</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitRequestAction} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Requested Changes</label>
              <Textarea name="requested_changes" rows={3} placeholder="Describe the changes you need" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Contact Email</label>
              <Input name="contact_email" type="email" defaultValue={profile.email} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Contact Phone</label>
              <Input name="contact_phone" defaultValue={profile.phone || ''} />
            </div>
            <Button type="submit" variant="outline">Submit Request</Button>
          </form>
          <p className="text-xs text-gray-500 mt-2">Requests require School Admin approval. This is a placeholder submission.</p>
        </CardContent>
      </Card>
    </div>
  )
}
