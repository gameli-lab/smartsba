import { supabase } from '@/lib/supabase'
import { ProfileClient } from '@/components/student/profile-client'
import { requireStudentWithAutoInit, renderStudentProfileError } from '../utils'

export default async function StudentProfilePage() {
  const guardResult = await requireStudentWithAutoInit()

  if (!guardResult.success) {
    return renderStudentProfileError(guardResult.error!)
  }

  const { student, profile } = guardResult.guard!

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
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Profile</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">View your profile information and request updates if needed.</p>
      </div>

      <ProfileClient student={studentData} />
    </div>
  )
}
