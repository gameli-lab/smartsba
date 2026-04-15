import { redirect } from 'next/navigation'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { ProfileEditor } from '@/components/profile/profile-editor'

export default async function ProfilePage() {
  const supabase = await createServerComponentClient()
  const admin = createAdminSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, user_id, role, full_name, email, phone, address, photo_url, staff_id, admission_number, school_id, gender, date_of_birth')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    redirect('/login')
  }

  const typedProfile = profile as {
    id: string
    user_id: string
    role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent'
    full_name: string
    email: string
    phone: string | null
    address: string | null
    photo_url: string | null
    staff_id?: string | null
    admission_number?: string | null
    school_id?: string | null
    gender?: string | null
    date_of_birth?: string | null
  }

  const metadata = [
    { label: 'Role', value: typedProfile.role.replace(/_/g, ' ') },
    { label: 'Staff ID', value: typedProfile.staff_id },
    { label: 'Admission Number', value: typedProfile.admission_number },
    { label: 'School ID', value: typedProfile.school_id },
    { label: 'Gender', value: typedProfile.gender },
    { label: 'Date of Birth', value: typedProfile.date_of_birth },
  ].filter((item) => Boolean(item.value))

  if (typedProfile.role === 'teacher') {
    const { data: teacherRow } = await (admin as any)
      .from('teachers')
      .select('id, specialization, qualification')
      .eq('user_id', typedProfile.user_id)
      .maybeSingle()

    if (teacherRow?.id) {
      const { data: assignments } = await (admin as any)
        .from('teacher_assignments')
        .select('id, is_class_teacher, class_id')
        .eq('teacher_id', teacherRow.id)

      const classIds = Array.from(new Set((assignments || []).map((row: any) => row.class_id).filter(Boolean)))
      metadata.push({ label: 'Teaching Assignments', value: String((assignments || []).length) })
      metadata.push({ label: 'Distinct Classes', value: String(classIds.length) })
      metadata.push({ label: 'Class Teacher Roles', value: String((assignments || []).filter((row: any) => row.is_class_teacher).length) })
    }

    if (teacherRow?.specialization) {
      metadata.push({ label: 'Specialization', value: teacherRow.specialization })
    }

    if (teacherRow?.qualification) {
      metadata.push({ label: 'Qualification', value: teacherRow.qualification })
    }
  }

  if (typedProfile.role === 'student') {
    const { data: studentRow } = await (admin as any)
      .from('students')
      .select('class_id, admission_number, roll_number, admission_date')
      .eq('user_id', typedProfile.user_id)
      .maybeSingle()

    if (studentRow?.class_id) {
      const { data: classRow } = await (admin as any)
        .from('classes')
        .select('name, stream')
        .eq('id', studentRow.class_id)
        .maybeSingle()

      if (classRow) {
        metadata.push({
          label: 'Class',
          value: classRow.stream ? `${classRow.name} - ${classRow.stream}` : classRow.name,
        })
      }
    }

    if (studentRow?.roll_number) {
      metadata.push({ label: 'Roll Number', value: studentRow.roll_number })
    }

    if (studentRow?.admission_date) {
      metadata.push({ label: 'Admission Date', value: studentRow.admission_date })
    }
  }

  if (typedProfile.role === 'parent') {
    const { data: links } = await (admin as any)
      .from('parent_student_links')
      .select('student_id, is_primary')
      .eq('parent_id', typedProfile.id)

    const studentIds = Array.from(new Set((links || []).map((link: any) => link.student_id).filter(Boolean)))
    const primaryCount = (links || []).filter((link: any) => Boolean(link.is_primary)).length
    metadata.push({ label: 'Linked Wards', value: String(studentIds.length) })
    metadata.push({ label: 'Primary Wards', value: String(primaryCount) })

    if (studentIds.length > 0) {
      const { data: studentRows } = await (admin as any)
        .from('students')
        .select('id, user_id, admission_number, class_id')
        .in('id', studentIds)

      const classIds = Array.from(new Set((studentRows || []).map((row: any) => row.class_id).filter(Boolean)))
      const userIds = Array.from(new Set((studentRows || []).map((row: any) => row.user_id).filter(Boolean)))

      const [{ data: classRows }, { data: profileRows }] = await Promise.all([
        classIds.length
          ? (admin as any).from('classes').select('id, name, stream').in('id', classIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? (admin as any).from('user_profiles').select('user_id, full_name').in('user_id', userIds)
          : Promise.resolve({ data: [] }),
      ])

      const classMap = new Map((classRows || []).map((row: any) => [row.id, row.stream ? `${row.name} - ${row.stream}` : row.name]))
      const profileMap = new Map((profileRows || []).map((row: any) => [row.user_id, row.full_name]))

      const wardLabels = (studentRows || []).slice(0, 3).map((studentRow: any) => {
        const name = profileMap.get(studentRow.user_id) || 'Student'
        const className = classMap.get(studentRow.class_id) || 'Class N/A'
        return `${name} (${studentRow.admission_number}) - ${className}`
      })

      if (wardLabels.length > 0) {
        metadata.push({ label: 'Ward Snapshot', value: wardLabels.join(' | ') })
      }
    }
  }

  if (typedProfile.role === 'school_admin' && typedProfile.school_id) {
    const { data: schoolRow } = await (admin as any)
      .from('schools')
      .select('name, status')
      .eq('id', typedProfile.school_id)
      .maybeSingle()

    if (schoolRow?.name) {
      metadata.push({ label: 'School Name', value: schoolRow.name })
    }

    if (schoolRow?.status) {
      metadata.push({ label: 'School Status', value: schoolRow.status })
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <ProfileEditor
        roleLabel={typedProfile.role.replace(/_/g, ' ').toUpperCase()}
        fullName={typedProfile.full_name}
        email={typedProfile.email}
        phone={typedProfile.phone || ''}
        address={typedProfile.address || ''}
        photoUrl={typedProfile.photo_url}
        metadata={metadata}
      />
    </div>
  )
}
