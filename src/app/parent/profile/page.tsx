export default async function ParentProfilePage() {
  const { redirect } = await import('next/navigation')
  redirect('/profile')
}
