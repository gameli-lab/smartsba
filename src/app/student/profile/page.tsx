import { requireStudent } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ProfileClient } from '@/components/student/profile-client'

export default async function StudentProfilePage() {
  const guard = await requireStudent()

  if (!guard.student) {
    return (
      <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-semibold">Student profile not found</h1>
        <p className="mt-2 text-sm">Please contact your school administrator to complete your enrollment.</p>
      </div>
    )
  }

  const { student, profile } = guard

  // Fetch class info
  let className: string | null = null
  if (student.class_id) {
    const { data: classData } = await supabase
      .from('classes')
      .select('name, stream')
      .eq('id', student.class_id)
      .maybeSingle()

    if (classData) {
      const klass = classData as { name: string; stream?: string | null }
      className = klass.stream ? `${klass.name} - ${klass.stream}` : klass.name
    }
  }

  const studentData = {
    id: student.id,
    admission_number: student.admission_number,
    class_name: className,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone || null,
    address: profile.address || null,
    date_of_birth: student.date_of_birth,
    gender: student.gender,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-600">View your profile information and request updates if needed.</p>
      </div>

      <ProfileClient student={studentData} />
    </div>
  )
}
