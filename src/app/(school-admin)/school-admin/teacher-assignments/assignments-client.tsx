'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getLevelGroupByNumber } from '@/lib/constants/level-groups'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, UserCog, Trash2, Edit } from 'lucide-react'
import { createAssignment, updateAssignment, deleteAssignment, setClassTeacher } from './actions'

interface TeacherOption {
  id: string
  user_id?: string
  full_name: string
  staff_id: string
  email: string
  is_active: boolean
}

interface ClassOption {
  id: string
  name: string
  level: number
  stream?: string | null
  class_teacher_id?: string | null
}

interface SubjectOption {
  id: string
  name: string
  code?: string | null
  level_group?: string
}

interface AssignmentRow {
  id: string
  class_id: string
  subject_id: string
  teacher_id: string
  academic_year: string
  class_name: string
  class_level: number
  class_stream?: string | null
  subject_name: string
  subject_code?: string | null
  teacher_name: string
  teacher_staff_id: string
}

interface Props {
  classes: ClassOption[]
  subjects: SubjectOption[]
  teachers: TeacherOption[]
  assignments: AssignmentRow[]
}

function formatClassName(cls: ClassOption | { name: string; level: number; stream?: string | null }) {
  return `${cls.name} (Level ${cls.level}${cls.stream ? ` - ${cls.stream}` : ''})`
}

export function AssignmentsClient({ classes, subjects, teachers, assignments }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [classTeacherClass, setClassTeacherClass] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const classTeacherMap = useMemo(() => {
    const map: Record<string, TeacherOption | undefined> = {}
    classes.forEach((cls) => {
      if (cls.class_teacher_id) {
        const teacher = teachers.find((t) => t.id === cls.class_teacher_id || t.user_id === cls.class_teacher_id)
        if (teacher) map[cls.id] = teacher
      }
    })
    return map
  }, [classes, teachers])

  const assignmentsById = useMemo(() => {
    const map: Record<string, AssignmentRow> = {}
    assignments.forEach((a) => { map[a.id] = a })
    return map
  }, [assignments])

  const [createForm, setCreateForm] = useState({
    class_id: '',
    subject_id: '',
    teacher_id: '',
    academic_year: '',
  })

  const [editForm, setEditForm] = useState({
    teacher_id: '',
    academic_year: '',
  })

  const [classTeacherForm, setClassTeacherForm] = useState({
    class_id: '',
    teacher_id: '',
  })

  const filteredSubjects = useMemo(() => {
    if (!createForm.class_id) return subjects
    
    // Get the selected class and its level group
    const selectedClass = classes.find((c) => c.id === createForm.class_id)
    if (!selectedClass) return subjects
    
    const levelGroup = getLevelGroupByNumber(selectedClass.level)
    if (!levelGroup) return subjects
    
    // Filter subjects to show only those matching the class's level group
    return subjects.filter((s) => s.level_group === levelGroup.key)
  }, [createForm.class_id, subjects, classes])

  // Clear subject selection if it's not in the filtered list
  useEffect(() => {
    if (createForm.subject_id && !filteredSubjects.find((s) => s.id === createForm.subject_id)) {
      setCreateForm((p) => ({ ...p, subject_id: '' }))
    }
  }, [filteredSubjects, createForm.subject_id])

  const handleCreate = async () => {
    setIsSubmitting(true)
    setError(null)
    const result = await createAssignment({
      class_id: createForm.class_id,
      subject_id: createForm.subject_id,
      teacher_id: createForm.teacher_id,
      academic_year: createForm.academic_year || undefined,
    })
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.error || 'Failed to create assignment')
      return
    }
    setCreateOpen(false)
    setCreateForm({ class_id: '', subject_id: '', teacher_id: '', academic_year: '' })
    router.refresh()
  }

  const openEdit = (id: string) => {
    const row = assignmentsById[id]
    if (!row) return
    setEditId(id)
    setEditForm({ teacher_id: row.teacher_id, academic_year: row.academic_year })
  }

  const handleEdit = async () => {
    if (!editId) return
    setIsSubmitting(true)
    setError(null)
    const result = await updateAssignment({
      id: editId,
      teacher_id: editForm.teacher_id || undefined,
      academic_year: editForm.academic_year || undefined,
    })
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.error || 'Failed to update assignment')
      return
    }
    setEditId(null)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this assignment?')) return
    setIsSubmitting(true)
    const result = await deleteAssignment(id)
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.error || 'Failed to delete assignment')
      return
    }
    router.refresh()
  }

  const handleSetClassTeacher = async () => {
    if (!classTeacherClass) return
    setIsSubmitting(true)
    setError(null)
    const result = await setClassTeacher(classTeacherClass, classTeacherForm.teacher_id)
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.error || 'Failed to assign class teacher')
      return
    }
    setClassTeacherClass(null)
    setClassTeacherForm({ class_id: '', teacher_id: '' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Teacher Assignments</h1>
          <p className="text-gray-600 dark:text-gray-300">Assign teachers to subjects and classes</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); setError(null) }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Subject Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Assign Teacher to Subject</DialogTitle>
              <DialogDescription>Select class, subject, teacher, and academic year</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={createForm.class_id} onValueChange={(v) => setCreateForm((p) => ({ ...p, class_id: v, subject_id: '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {formatClassName(cls)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={createForm.subject_id} onValueChange={(v) => setCreateForm((p) => ({ ...p, subject_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={createForm.class_id ? 'Select subject' : 'Select class first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map((subj) => (
                      <SelectItem key={subj.id} value={subj.id}>
                        {subj.name}{subj.code ? ` (${subj.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={createForm.teacher_id} onValueChange={(v) => setCreateForm((p) => ({ ...p, teacher_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.filter((t) => t.is_active).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name} ({t.staff_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Input
                  placeholder="e.g., 2024-2025"
                  value={createForm.academic_year}
                  onChange={(e) => setCreateForm((p) => ({ ...p, academic_year: e.target.value }))}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Assignment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Teacher Assignment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => (
            <div key={cls.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-2 bg-white dark:bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{formatClassName(cls)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {classTeacherMap[cls.id]?.full_name ? `Class Teacher: ${classTeacherMap[cls.id]?.full_name}` : 'No class teacher assigned'}
                  </p>
                </div>
                <Dialog open={classTeacherClass === cls.id} onOpenChange={(open) => {
                  setClassTeacherClass(open ? cls.id : null)
                  setClassTeacherForm({ class_id: open ? cls.id : '', teacher_id: '' })
                  setError(null)
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserCog className="mr-2 h-4 w-4" />
                      Set Teacher
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Class Teacher</DialogTitle>
                      <DialogDescription>{formatClassName(cls)}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Teacher</Label>
                        <Select value={classTeacherForm.teacher_id} onValueChange={(v) => setClassTeacherForm({ class_id: cls.id, teacher_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.filter((t) => t.is_active).map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.full_name} ({t.staff_id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setClassTeacherClass(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSetClassTeacher} disabled={isSubmitting || !classTeacherForm.teacher_id}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
        <CardHeader>
          <CardTitle>Subject Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.class_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Level {row.class_level}{row.class_stream ? ` • ${row.class_stream}` : ''}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.subject_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.subject_code || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.teacher_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.teacher_staff_id}</div>
                    </TableCell>
                    <TableCell>{row.academic_year}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={editId === row.id} onOpenChange={(open) => {
                          if (open) openEdit(row.id); else setEditId(null)
                          setError(null)
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Assignment</DialogTitle>
                              <DialogDescription>{row.class_name} — {row.subject_name}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Teacher</Label>
                                <Select value={editForm.teacher_id} onValueChange={(v) => setEditForm((p) => ({ ...p, teacher_id: v }))}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select teacher" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teachers.filter((t) => t.is_active).map((t) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.full_name} ({t.staff_id})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Academic Year</Label>
                                <Input
                                  value={editForm.academic_year}
                                  onChange={(e) => setEditForm((p) => ({ ...p, academic_year: e.target.value }))}
                                />
                              </div>
                              {error && (
                                <Alert variant="destructive">
                                  <AlertDescription>{error}</AlertDescription>
                                </Alert>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditId(null)} disabled={isSubmitting}>Cancel</Button>
                                <Button onClick={handleEdit} disabled={isSubmitting}>
                                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(row.id)} disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {assignments.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-6">No assignments yet. Create one to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
