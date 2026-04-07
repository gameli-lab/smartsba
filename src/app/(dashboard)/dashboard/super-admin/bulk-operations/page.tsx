"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2, Loader2, Download } from 'lucide-react'
import {
  bulkActivateSchools,
  bulkDeactivateSchools,
  bulkDeleteSchools,
  bulkActivateUsers,
  bulkDeactivateUsers,
  bulkDeleteUsers,
} from './actions'

interface School {
  id: string
  name: string
  status: 'active' | 'inactive'
  created_at: string
}

interface User {
  id: string
  email: string
  role: string
  school_id: string | null
  created_at: string
}

interface OperationResult {
  success: boolean
  successCount: number
  failureCount: number
  failures: Array<{ id: string; error: string }>
  message: string
}

type ExportRow = Record<string, unknown>

export default function BulkOperationsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<OperationResult | null>(null)

  // Schools state
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set())
  const [schoolAction, setSchoolAction] = useState<'activate' | 'deactivate' | 'delete'>('activate')

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userAction, setUserAction] = useState<'activate' | 'deactivate' | 'delete'>('activate')

  // Export state
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [exportType, setExportType] = useState<'schools' | 'users' | 'logs'>('schools')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        const profileResponse = (await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()) as { data: { role: string } | null }
        if (profileResponse.data) {
          setUserRole(profileResponse.data.role)
        }
      }
      await Promise.all([fetchSchools(), fetchUsers()])
      setLoading(false)
    }
    init()
  }, [])

  const fetchSchools = async () => {
    try {
      const { data } = await supabase
        .from('schools')
        .select('id, name, status, created_at')
        .order('created_at', { ascending: false })
      setSchools(data || [])
    } catch (err) {
      console.error('Error fetching schools:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, role, school_id, created_at')
        .order('created_at', { ascending: false })
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const handleSchoolToggle = (schoolId: string) => {
    const newSelection = new Set(selectedSchools)
    if (newSelection.has(schoolId)) {
      newSelection.delete(schoolId)
    } else {
      newSelection.add(schoolId)
    }
    setSelectedSchools(newSelection)
  }

  const handleUserToggle = (userId: string) => {
    const newSelection = new Set(selectedUsers)
    if (newSelection.has(userId)) {
      newSelection.delete(userId)
    } else {
      newSelection.add(userId)
    }
    setSelectedUsers(newSelection)
  }

  const executeSchoolOperation = async () => {
    if (!userId || !userRole || selectedSchools.size === 0) return

    setExecuting(true)
    setError(null)
    setSuccess(null)

    try {
      let result: OperationResult | null = null

      const schoolIds = Array.from(selectedSchools)

      if (schoolAction === 'activate') {
        result = await bulkActivateSchools(schoolIds, userId, userRole)
      } else if (schoolAction === 'deactivate') {
        result = await bulkDeactivateSchools(schoolIds, userId, userRole)
      } else if (schoolAction === 'delete') {
        result = await bulkDeleteSchools(schoolIds, userId, userRole)
      }

      if (result) {
        setSuccess(result)
        if (result.success) {
          setSelectedSchools(new Set())
          await fetchSchools()
        }
        setTimeout(() => setSuccess(null), 5000)
      }
    } catch (err) {
      setError((err as Error).message || 'Operation failed')
    } finally {
      setExecuting(false)
    }
  }

  const executeUserOperation = async () => {
    if (!userId || !userRole || selectedUsers.size === 0) return

    setExecuting(true)
    setError(null)
    setSuccess(null)

    try {
      let result: OperationResult | null = null

      const userIds = Array.from(selectedUsers)

      if (userAction === 'activate') {
        result = await bulkActivateUsers(userIds, userId, userRole)
      } else if (userAction === 'deactivate') {
        result = await bulkDeactivateUsers(userIds, userId, userRole)
      } else if (userAction === 'delete') {
        result = await bulkDeleteUsers(userIds, userId, userRole)
      }

      if (result) {
        setSuccess(result)
        if (result.success) {
          setSelectedUsers(new Set())
          await fetchUsers()
        }
        setTimeout(() => setSuccess(null), 5000)
      }
    } catch (err) {
      setError((err as Error).message || 'Operation failed')
    } finally {
      setExecuting(false)
    }
  }

  const exportData = async () => {
    setExporting(true)
    try {
      let data: ExportRow[] = []
      let filename = ''

      if (exportType === 'schools') {
        data = schools
        filename = `schools_export_${new Date().toISOString().split('T')[0]}`
      } else if (exportType === 'users') {
        data = users
        filename = `users_export_${new Date().toISOString().split('T')[0]}`
      } else if (exportType === 'logs') {
        const { data: logs } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000)
        data = logs || []
        filename = `audit_logs_export_${new Date().toISOString().split('T')[0]}`
      }

      if (exportFormat === 'csv') {
        downloadCSV(data, filename)
      } else if (exportFormat === 'json') {
        downloadJSON(data, filename)
      }
    } catch {
      setError('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const downloadCSV = (data: ExportRow[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header]
            return typeof value === 'string' && value.includes(',')
              ? `"${value}"`
              : String(value ?? '')
          })
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadJSON = (data: ExportRow[], filename: string) => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Bulk Operations</h1>
        <p className="mt-2 text-sm text-gray-600">Perform bulk actions on schools and users</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className={success.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
          <CheckCircle2 className={`h-4 w-4 ${success.success ? 'text-green-600' : 'text-yellow-600'}`} />
          <AlertDescription className={success.success ? 'text-green-800' : 'text-yellow-800'}>
            {success.message} (Success: {success.successCount}, Failed: {success.failureCount})
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="schools" className="w-full">
        <TabsList>
          <TabsTrigger value="schools">Schools ({selectedSchools.size})</TabsTrigger>
          <TabsTrigger value="users">Users ({selectedUsers.size})</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
        </TabsList>

        {/* Schools Tab */}
        <TabsContent value="schools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk School Operations</CardTitle>
              <CardDescription>Select schools and choose an action to perform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Action Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="school-action">Action</Label>
                  <Select
                    value={schoolAction}
                    onValueChange={(value) => setSchoolAction(value as 'activate' | 'deactivate' | 'delete')}
                  >
                    <SelectTrigger id="school-action" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activate">Activate Schools</SelectItem>
                      <SelectItem value="deactivate">Deactivate Schools</SelectItem>
                      <SelectItem value="delete">Delete Schools</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={executeSchoolOperation}
                    disabled={selectedSchools.size === 0 || executing}
                    className="w-full"
                    variant={schoolAction === 'delete' ? 'destructive' : 'default'}
                  >
                    {executing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Execute on ${selectedSchools.size} School${selectedSchools.size !== 1 ? 's' : ''}`
                    )}
                  </Button>
                </div>
              </div>

              {/* Schools List */}
              <div className="border rounded-lg">
                <div className="max-h-96 overflow-y-auto">
                  {schools.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No schools found</div>
                  ) : (
                    <div className="space-y-1">
                      {schools.map((school) => (
                        <div
                          key={school.id}
                          className="flex items-center p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleSchoolToggle(school.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSchools.has(school.id)}
                            onChange={() => handleSchoolToggle(school.id)}
                            className="w-4 h-4 rounded"
                          />
                          <div className="ml-4 flex-1">
                            <p className="font-medium text-gray-900">{school.name}</p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(school.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={school.status === 'active' ? 'default' : 'secondary'}
                            className={
                              school.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {school.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk User Operations</CardTitle>
              <CardDescription>Select users and choose an action to perform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Action Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user-action">Action</Label>
                  <Select
                    value={userAction}
                    onValueChange={(value) => setUserAction(value as 'activate' | 'deactivate' | 'delete')}
                  >
                    <SelectTrigger id="user-action" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activate">Activate Users</SelectItem>
                      <SelectItem value="deactivate">Deactivate Users</SelectItem>
                      <SelectItem value="delete">Delete Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={executeUserOperation}
                    disabled={selectedUsers.size === 0 || executing}
                    className="w-full"
                    variant={userAction === 'delete' ? 'destructive' : 'default'}
                  >
                    {executing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Execute on ${selectedUsers.size} User${selectedUsers.size !== 1 ? 's' : ''}`
                    )}
                  </Button>
                </div>
              </div>

              {/* Users List */}
              <div className="border rounded-lg">
                <div className="max-h-96 overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No users found</div>
                  ) : (
                    <div className="space-y-1">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleUserToggle(user.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleUserToggle(user.id)}
                            className="w-4 h-4 rounded"
                          />
                          <div className="ml-4 flex-1">
                            <p className="font-medium text-gray-900">{user.email}</p>
                            <p className="text-xs text-gray-500">
                              {user.role} • Created {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline">{user.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Download platform data in CSV or JSON format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="export-type">Data Type</Label>
                  <Select
                    value={exportType}
                    onValueChange={(value) => setExportType(value as 'schools' | 'users' | 'logs')}
                  >
                    <SelectTrigger id="export-type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="schools">Schools ({schools.length})</SelectItem>
                      <SelectItem value="users">Users ({users.length})</SelectItem>
                      <SelectItem value="logs">Audit Logs (Last 1000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-format">Format</Label>
                  <Select
                    value={exportFormat}
                    onValueChange={(value) => setExportFormat(value as 'csv' | 'json')}
                  >
                    <SelectTrigger id="export-format" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                      <SelectItem value="json">JSON (.json)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={exportData}
                disabled={exporting}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Preparing Download...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download {exportType} as {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Export Information</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {exportType === 'schools' && <li>• {schools.length} schools will be exported</li>}
                  {exportType === 'users' && <li>• {users.length} users will be exported</li>}
                  {exportType === 'logs' && <li>• Last 1000 audit log entries will be exported</li>}
                  <li>• File will be named with current date</li>
                  <li>• All sensitive data will be included in the export</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
