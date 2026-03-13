type Ward = {
  student: {
    id: string
    class_id: string | null
  }
  is_primary: boolean
}

export function selectWard(wards: Ward[], requestedWardId?: string) {
  const defaultWardId = wards.find((w) => w.is_primary)?.student.id || wards[0]?.student.id
  const wardId = requestedWardId || defaultWardId
  const selectedWard = wards.find((w) => w.student.id === wardId) || null

  return {
    wardId,
    selectedWard,
  }
}

export function buildParentAnnouncementFilter(classId: string | null | undefined) {
  if (!classId) {
    return 'target_audience.cs.{parent}'
  }
  return `target_audience.cs.{parent},class_ids.cs.{${classId}}`
}
