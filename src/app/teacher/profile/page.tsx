export default async function TeacherProfilePage() {
  const { redirect } = await import('next/navigation')
  redirect('/profile')
}
