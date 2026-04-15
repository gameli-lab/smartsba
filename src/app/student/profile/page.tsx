export default async function StudentProfilePage() {
  const { redirect } = await import('next/navigation')
  redirect('/profile')
}
