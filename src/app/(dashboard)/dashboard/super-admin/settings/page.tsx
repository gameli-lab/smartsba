'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle2, Loader2, Settings as SettingsIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getSystemSettings, updateSystemSetting } from './actions'

interface SystemSetting {
  id: string
  setting_key: string
  setting_value: any
  description: string | null
  category: string
  updated_at: string
  updated_by: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      setUserId(session.user.id)

      const profileResponse = (await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()) as { data: { role: string } | null }

      const profile = profileResponse.data

      if (!profile || profile.role !== 'super_admin') {
        setError('Unauthorized: Super admin access required')
        setLoading(false)
        return
      }

      setUserRole(profile.role)
      await loadSettings()
    }

    checkAuth()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setError(null)

    const result = await getSystemSettings()

    if (result.error) {
      setError(result.error)
    } else {
      setSettings(result.settings)
    }

    setLoading(false)
  }

  async function handleUpdateSetting(settingKey: string, newValue: any) {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSaving(settingKey)
    setError(null)
    setSuccess(null)

    const result = await updateSystemSetting(settingKey, newValue, userId, userRole)

    if (result.success) {
      setSuccess(`Setting "${settingKey}" updated successfully`)
      await loadSettings()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(result.error || 'Failed to update setting')
    }

    setSaving(null)
  }

  function getSetting(key: string): SystemSetting | undefined {
    return settings.find((s) => s.setting_key === key)
  }

  function getSettingValue(key: string, defaultValue: any = null): any {
    const setting = getSetting(key)
    return setting ? setting.setting_value : defaultValue
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !userRole) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Settings</h1>
        <p className="text-muted-foreground">
          Configure platform-wide defaults. Changes apply to new schools only unless explicitly stated.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="grading">Grading</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Module Toggles</CardTitle>
              <CardDescription>Enable or disable platform modules for new schools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'features.students_module', label: 'Students Module' },
                { key: 'features.parents_module', label: 'Parents Module' },
                { key: 'features.teachers_module', label: 'Teachers Module' },
                { key: 'features.analytics_module', label: 'Analytics Module' },
                { key: 'features.reports_module', label: 'Reports Module' },
                { key: 'features.announcements_module', label: 'Announcements Module' },
              ].map(({ key, label }) => {
                const setting = getSetting(key)
                const isEnabled = getSettingValue(key, true)

                return (
                  <div key={key} className="flex items-center justify-between space-x-2">
                    <Label htmlFor={key} className="flex-1">
                      {label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={key}
                        checked={isEnabled}
                        onCheckedChange={(checked: boolean) => handleUpdateSetting(key, checked)}
                        disabled={saving === key}
                      />
                      {saving === key && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    {setting?.updated_at && (
                      <span className="text-xs text-muted-foreground">
                        Updated {new Date(setting.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grading Tab */}
        <TabsContent value="grading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Default Grading System</CardTitle>
              <CardDescription>Default grading configuration for new schools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pass_mark">Pass Mark (%)</Label>
                <Input
                  id="pass_mark"
                  type="number"
                  min="0"
                  max="100"
                  value={getSettingValue('grading.default_pass_mark', 40)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      handleUpdateSetting('grading.default_pass_mark', value)
                    }
                  }}
                  disabled={saving === 'grading.default_pass_mark'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ca_weight">Continuous Assessment Weight (%)</Label>
                <Input
                  id="ca_weight"
                  type="number"
                  min="0"
                  max="100"
                  value={getSettingValue('grading.default_ca_weight', 40)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      handleUpdateSetting('grading.default_ca_weight', value)
                    }
                  }}
                  disabled={saving === 'grading.default_ca_weight'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam_weight">Exam Weight (%)</Label>
                <Input
                  id="exam_weight"
                  type="number"
                  min="0"
                  max="100"
                  value={getSettingValue('grading.default_exam_weight', 60)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      handleUpdateSetting('grading.default_exam_weight', value)
                    }
                  }}
                  disabled={saving === 'grading.default_exam_weight'}
                />
              </div>

              <Alert>
                <SettingsIcon className="h-4 w-4" />
                <AlertDescription>
                  CA Weight + Exam Weight should equal 100%. Schools can customize these values after creation.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Academic Calendar Defaults</CardTitle>
              <CardDescription>Default calendar settings for new schools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="terms_per_year">Terms Per Year</Label>
                <Input
                  id="terms_per_year"
                  type="number"
                  min="1"
                  max="4"
                  value={getSettingValue('calendar.terms_per_year', 3)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 1 && value <= 4) {
                      handleUpdateSetting('calendar.terms_per_year', value)
                    }
                  }}
                  disabled={saving === 'calendar.terms_per_year'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeks_per_term">Weeks Per Term</Label>
                <Input
                  id="weeks_per_term"
                  type="number"
                  min="1"
                  max="20"
                  value={getSettingValue('calendar.weeks_per_term', 13)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 1 && value <= 20) {
                      handleUpdateSetting('calendar.weeks_per_term', value)
                    }
                  }}
                  disabled={saving === 'calendar.weeks_per_term'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academic_year_start">Academic Year Start Month</Label>
                <select
                  id="academic_year_start"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={getSettingValue('calendar.academic_year_start_month', 9)}
                  onChange={(e) => handleUpdateSetting('calendar.academic_year_start_month', parseInt(e.target.value))}
                  disabled={saving === 'calendar.academic_year_start_month'}
                >
                  {[
                    { value: 1, label: 'January' },
                    { value: 2, label: 'February' },
                    { value: 3, label: 'March' },
                    { value: 4, label: 'April' },
                    { value: 5, label: 'May' },
                    { value: 6, label: 'June' },
                    { value: 7, label: 'July' },
                    { value: 8, label: 'August' },
                    { value: 9, label: 'September' },
                    { value: 10, label: 'October' },
                    { value: 11, label: 'November' },
                    { value: 12, label: 'December' },
                  ].map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Result Publication Rules</CardTitle>
              <CardDescription>Control how results are published and distributed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <Label htmlFor="require_approval">Require Admin Approval Before Publishing</Label>
                  <p className="text-sm text-muted-foreground">Results must be approved before visibility to students/parents</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_approval"
                    checked={getSettingValue('results.require_admin_approval', true)}
                    onCheckedChange={(checked: boolean) => handleUpdateSetting('results.require_admin_approval', checked)}
                    disabled={saving === 'results.require_admin_approval'}
                  />
                  {saving === 'results.require_admin_approval' && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <Label htmlFor="notify_parents">Notify Parents on Result Publication</Label>
                  <p className="text-sm text-muted-foreground">Send email notifications when results are published</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="notify_parents"
                    checked={getSettingValue('results.notify_parents_on_publish', true)}
                    onCheckedChange={(checked: boolean) => handleUpdateSetting('results.notify_parents_on_publish', checked)}
                    disabled={saving === 'results.notify_parents_on_publish'}
                  />
                  {saving === 'results.notify_parents_on_publish' && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Password Policy</CardTitle>
              <CardDescription>Platform-wide password requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="min_length">Minimum Password Length</Label>
                <Input
                  id="min_length"
                  type="number"
                  min="6"
                  max="20"
                  value={getSettingValue('security.password_min_length', 8)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 6 && value <= 20) {
                      handleUpdateSetting('security.password_min_length', value)
                    }
                  }}
                  disabled={saving === 'security.password_min_length'}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_uppercase">Require Uppercase Letter</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_uppercase"
                    checked={getSettingValue('security.password_require_uppercase', true)}
                    onCheckedChange={(checked: boolean) => handleUpdateSetting('security.password_require_uppercase', checked)}
                    disabled={saving === 'security.password_require_uppercase'}
                  />
                  {saving === 'security.password_require_uppercase' && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_lowercase">Require Lowercase Letter</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_lowercase"
                    checked={getSettingValue('security.password_require_lowercase', true)}
                    onCheckedChange={(checked: boolean) => handleUpdateSetting('security.password_require_lowercase', checked)}
                    disabled={saving === 'security.password_require_lowercase'}
                  />
                  {saving === 'security.password_require_lowercase' && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_number">Require Number</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_number"
                    checked={getSettingValue('security.password_require_number', true)}
                    onCheckedChange={(checked: boolean) => handleUpdateSetting('security.password_require_number', checked)}
                    disabled={saving === 'security.password_require_number'}
                  />
                  {saving === 'security.password_require_number' && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Login Security</CardTitle>
              <CardDescription>Failed login attempt and session policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="max_attempts">Maximum Failed Login Attempts</Label>
                <Input
                  id="max_attempts"
                  type="number"
                  min="3"
                  max="10"
                  value={getSettingValue('security.max_login_attempts', 5)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 3 && value <= 10) {
                      handleUpdateSetting('security.max_login_attempts', value)
                    }
                  }}
                  disabled={saving === 'security.max_login_attempts'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lockout_duration">Account Lockout Duration (minutes)</Label>
                <Input
                  id="lockout_duration"
                  type="number"
                  min="5"
                  max="120"
                  value={getSettingValue('security.lockout_duration_minutes', 30)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 5 && value <= 120) {
                      handleUpdateSetting('security.lockout_duration_minutes', value)
                    }
                  }}
                  disabled={saving === 'security.lockout_duration_minutes'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  min="15"
                  max="480"
                  value={getSettingValue('security.session_timeout_minutes', 60)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 15 && value <= 480) {
                      handleUpdateSetting('security.session_timeout_minutes', value)
                    }
                  }}
                  disabled={saving === 'security.session_timeout_minutes'}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
