export function renderNoLinkedWardsState() {
  return (
    <div className="rounded-lg border bg-amber-50 p-6 text-amber-800">
      <h1 className="text-lg font-semibold">No Linked Students</h1>
      <p className="mt-2 text-sm">You do not have any wards linked to your account. Please contact your school administrator.</p>
    </div>
  )
}

export function renderWardNotFoundState() {
  return (
    <div className="rounded-lg border bg-red-50 p-6 text-red-800">
      <h1 className="text-lg font-semibold">Ward not found</h1>
      <p className="mt-2 text-sm">The selected ward was not found.</p>
    </div>
  )
}
