'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Settings as SettingsIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getSystemSettings, updateSystemSetting } from './actions'

interface SystemSetting {
  id: string
  setting_key: string
  setting_value: unknown
  description: string | null
  category: string
  updated_at: string
  updated_by: string | null
}

function toNumberSetting(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  return fallback
}

function toBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return fallback
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  // Grading form state
  const [gradingValues, setGradingValues] = useState({
    pass_mark: 40,
    ca_weight: 40,
    exam_weight: 60,
  })
  const [gradingDirty, setGradingDirty] = useState(false)
  const [savingGrading, setSavingGrading] = useState(false)

  // Calendar form state
  const [calendarValues, setCalendarValues] = useState({
    terms_per_year: 3,
    default_term_length_weeks: 13,
    academic_year_start_month: 9,
  })
  const [calendarDirty, setCalendarDirty] = useState(false)
  const [savingCalendar, setSavingCalendar] = useState(false)

  // Results form state
  const [resultsValues, setResultsValues] = useState({
    require_approval: true,
    parent_notification_enabled: true,
  })
  const [resultsDirty, setResultsDirty] = useState(false)
  const [savingResults, setSavingResults] = useState(false)

  // Security form state
  const [securityValues, setSecurityValues] = useState({
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_number: true,
    password_require_special: false,
    login_lockout_attempts: 5,
    login_lockout_duration_minutes: 30,
    session_timeout_minutes: 60,
    mfa_trusted_session_hours: 12,
    mfa_failure_spike_threshold_per_hour: 5,
  })
  const [securityDirty, setSecurityDirty] = useState(false)
  const [savingSecurity, setSavingSecurity] = useState(false)

  // Email configuration state
  const [emailValues, setEmailValues] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    sender_name: 'SmartSBA System',
    sender_email: 'noreply@smartsba.local',
  })
  const [emailDirty, setEmailDirty] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  // AI provider state
  const [aiValues, setAIValues] = useState({
    default_provider: 'anthropic' as 'anthropic' | 'openai' | 'gemini',
    anthropic_api_key: '',
    anthropic_model: 'claude-3-5-sonnet-20241022',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    gemini_api_key: '',
    gemini_model: 'gemini-1.5-pro',
  })
  const [aiConfigured, setAIConfigured] = useState({
    anthropic: false,
    openai: false,
    gemini: false,
  })
  const [aiDirty, setAIDirty] = useState(false)
  const [savingAI, setSavingAI] = useState(false)

  // Maintenance mode state
  const [maintenanceValues, setMaintenanceValues] = useState({
    maintenance_mode_enabled: false,
    maintenance_message: 'System maintenance in progress. Please try again later.',
  })
  const [maintenanceDirty, setMaintenanceDirty] = useState(false)
  const [savingMaintenance, setSavingMaintenance] = useState(false)

  // Feature toggles state
  const [featureValues, setFeatureValues] = useState({
    enable_bulk_operations: true,
    enable_analytics: true,
    enable_audit_logs: true,
    enable_email_notifications: true,
    enable_api_access: false,
    enable_two_factor_auth: false,
  })
  const featureValuesRef = useRef(featureValues)
  const [featureDirty, setFeatureDirty] = useState(false)
  const [savingFeatures, setSavingFeatures] = useState(false)

  // Backup state
  const [backupLoading] = useState(false)

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
        setError('Unauthorized: SysAdmin access required')
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
      // Initialize grading form values from settings
      const pass_mark = result.settings.find(s => s.setting_key === 'grading.pass_mark')?.setting_value
      const ca_weight = result.settings.find(s => s.setting_key === 'grading.ca_weight')?.setting_value
      const exam_weight = result.settings.find(s => s.setting_key === 'grading.exam_weight')?.setting_value
      
      setGradingValues({
        pass_mark: toNumberSetting(pass_mark, 40),
        ca_weight: toNumberSetting(ca_weight, 40),
        exam_weight: toNumberSetting(exam_weight, 60),
      })
      setGradingDirty(false)

      // Initialize calendar form values from settings
      const terms_per_year = result.settings.find(s => s.setting_key === 'calendar.terms_per_year')?.setting_value
      const default_term_length_weeks = result.settings.find(s => s.setting_key === 'calendar.default_term_length_weeks')?.setting_value
      const academic_year_start_month = result.settings.find(s => s.setting_key === 'calendar.academic_year_start_month')?.setting_value
      
      setCalendarValues({
        terms_per_year: toNumberSetting(terms_per_year, 3),
        default_term_length_weeks: toNumberSetting(default_term_length_weeks, 13),
        academic_year_start_month: toNumberSetting(academic_year_start_month, 9),
      })
      setCalendarDirty(false)

      // Initialize results form values from settings
      const require_approval = result.settings.find(s => s.setting_key === 'results.require_approval')?.setting_value
      const parent_notification_enabled = result.settings.find(s => s.setting_key === 'results.parent_notification_enabled')?.setting_value
      
      setResultsValues({
        require_approval: toBooleanSetting(require_approval, true),
        parent_notification_enabled: toBooleanSetting(parent_notification_enabled, true),
      })
      setResultsDirty(false)

      // Initialize security form values from settings
      const password_min_length = result.settings.find(s => s.setting_key === 'security.password_min_length')?.setting_value
      const password_require_uppercase = result.settings.find(s => s.setting_key === 'security.password_require_uppercase')?.setting_value
      const password_require_lowercase = result.settings.find(s => s.setting_key === 'security.password_require_lowercase')?.setting_value
      const password_require_number = result.settings.find(s => s.setting_key === 'security.password_require_number')?.setting_value
      const password_require_special = result.settings.find(s => s.setting_key === 'security.password_require_special')?.setting_value
      const login_lockout_attempts = result.settings.find(s => s.setting_key === 'security.login_lockout_attempts')?.setting_value
      const login_lockout_duration_minutes = result.settings.find(s => s.setting_key === 'security.login_lockout_duration_minutes')?.setting_value
      const session_timeout_minutes = result.settings.find(s => s.setting_key === 'security.session_timeout_minutes')?.setting_value
      const mfa_trusted_session_hours = result.settings.find(s => s.setting_key === 'security.mfa_trusted_session_hours')?.setting_value
      const mfa_failure_spike_threshold_per_hour = result.settings.find(s => s.setting_key === 'security.mfa_failure_spike_threshold_per_hour')?.setting_value
      
      setSecurityValues({
        password_min_length: toNumberSetting(password_min_length, 8),
        password_require_uppercase: toBooleanSetting(password_require_uppercase, true),
        password_require_lowercase: toBooleanSetting(password_require_lowercase, true),
        password_require_number: toBooleanSetting(password_require_number, true),
        password_require_special: toBooleanSetting(password_require_special, false),
        login_lockout_attempts: toNumberSetting(login_lockout_attempts, 5),
        login_lockout_duration_minutes: toNumberSetting(login_lockout_duration_minutes, 30),
        session_timeout_minutes: toNumberSetting(session_timeout_minutes, 60),
        mfa_trusted_session_hours: toNumberSetting(mfa_trusted_session_hours, 12),
        mfa_failure_spike_threshold_per_hour: toNumberSetting(mfa_failure_spike_threshold_per_hour, 5),
      })
      setSecurityDirty(false)

      // Initialize AI provider configuration from settings
      const ai_default_provider = result.settings.find(s => s.setting_key === 'ai.default_provider')?.setting_value || 'anthropic'
      const anthropic_api_key = result.settings.find(s => s.setting_key === 'ai.anthropic_api_key')?.setting_value
      const anthropic_model = result.settings.find(s => s.setting_key === 'ai.anthropic_model')?.setting_value || 'claude-3-5-sonnet-20241022'
      const openai_api_key = result.settings.find(s => s.setting_key === 'ai.openai_api_key')?.setting_value
      const openai_model = result.settings.find(s => s.setting_key === 'ai.openai_model')?.setting_value || 'gpt-4o-mini'
      const gemini_api_key = result.settings.find(s => s.setting_key === 'ai.gemini_api_key')?.setting_value
      const gemini_model = result.settings.find(s => s.setting_key === 'ai.gemini_model')?.setting_value || 'gemini-1.5-pro'

      setAIValues({
        default_provider: ai_default_provider === 'openai' || ai_default_provider === 'gemini' ? ai_default_provider : 'anthropic',
        anthropic_api_key: '',
        anthropic_model: typeof anthropic_model === 'string' ? anthropic_model : 'claude-3-5-sonnet-20241022',
        openai_api_key: '',
        openai_model: typeof openai_model === 'string' ? openai_model : 'gpt-4o-mini',
        gemini_api_key: '',
        gemini_model: typeof gemini_model === 'string' ? gemini_model : 'gemini-1.5-pro',
      })
      setAIConfigured({
        anthropic: Boolean(anthropic_api_key),
        openai: Boolean(openai_api_key),
        gemini: Boolean(gemini_api_key),
      })
      setAIDirty(false)

      // Initialize feature toggle form values from settings
      const enable_bulk_operations = result.settings.find(s => s.setting_key === 'features.enable_bulk_operations')?.setting_value ?? true
      const enable_analytics = result.settings.find(s => s.setting_key === 'features.enable_analytics')?.setting_value ?? true
      const enable_audit_logs = result.settings.find(s => s.setting_key === 'features.enable_audit_logs')?.setting_value ?? true
      const enable_email_notifications = result.settings.find(s => s.setting_key === 'features.enable_email_notifications')?.setting_value ?? true
      const enable_api_access = result.settings.find(s => s.setting_key === 'features.enable_api_access')?.setting_value ?? false
      const enable_two_factor_auth = result.settings.find(s => s.setting_key === 'features.enable_two_factor_auth')?.setting_value ?? false

      setFeatureValues({
        enable_bulk_operations: typeof enable_bulk_operations === 'string' ? enable_bulk_operations === 'true' : Boolean(enable_bulk_operations),
        enable_analytics: typeof enable_analytics === 'string' ? enable_analytics === 'true' : Boolean(enable_analytics),
        enable_audit_logs: typeof enable_audit_logs === 'string' ? enable_audit_logs === 'true' : Boolean(enable_audit_logs),
        enable_email_notifications: typeof enable_email_notifications === 'string' ? enable_email_notifications === 'true' : Boolean(enable_email_notifications),
        enable_api_access: typeof enable_api_access === 'string' ? enable_api_access === 'true' : Boolean(enable_api_access),
        enable_two_factor_auth: typeof enable_two_factor_auth === 'string' ? enable_two_factor_auth === 'true' : Boolean(enable_two_factor_auth),
      })
      featureValuesRef.current = {
        enable_bulk_operations: typeof enable_bulk_operations === 'string' ? enable_bulk_operations === 'true' : Boolean(enable_bulk_operations),
        enable_analytics: typeof enable_analytics === 'string' ? enable_analytics === 'true' : Boolean(enable_analytics),
        enable_audit_logs: typeof enable_audit_logs === 'string' ? enable_audit_logs === 'true' : Boolean(enable_audit_logs),
        enable_email_notifications: typeof enable_email_notifications === 'string' ? enable_email_notifications === 'true' : Boolean(enable_email_notifications),
        enable_api_access: typeof enable_api_access === 'string' ? enable_api_access === 'true' : Boolean(enable_api_access),
        enable_two_factor_auth: typeof enable_two_factor_auth === 'string' ? enable_two_factor_auth === 'true' : Boolean(enable_two_factor_auth),
      }
      setFeatureDirty(false)
    }

    setLoading(false)
  }

  async function handleUpdateSetting(settingKey: string, newValue: unknown) {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSaving(settingKey)
    setError(null)
    setSuccess(null)

    // Optimistically update local state immediately for instant UI feedback
    setSettings(prev => prev.map(s => 
      s.setting_key === settingKey 
        ? { ...s, setting_value: newValue, updated_at: new Date().toISOString() }
        : s
    ))

    console.log('Updating setting:', settingKey, 'to:', newValue)
    const result = await updateSystemSetting(settingKey, newValue, userId, userRole)
    console.log('Update result:', result)

    if (result.success) {
      setSuccess(`Setting "${settingKey}" updated successfully`)
      
      // Reload settings from server after a short delay to ensure DB update propagated
      setTimeout(async () => {
        console.log('Reloading settings from server...')
        await loadSettings()
      }, 500)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } else {
      // Revert optimistic update on error
      console.log('Update failed, reverting...')
      await loadSettings()
      setError(result.error || 'Failed to update setting')
    }

    setSaving(null)
  }

  async function saveGradingSettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingGrading(true)
    setError(null)
    setSuccess(null)

    try {
      // Save all grading settings
      await updateSystemSetting('grading.pass_mark', gradingValues.pass_mark, userId, userRole)
      await updateSystemSetting('grading.ca_weight', gradingValues.ca_weight, userId, userRole)
      await updateSystemSetting('grading.exam_weight', gradingValues.exam_weight, userId, userRole)
      
      setSuccess('Grading settings saved successfully')
      setGradingDirty(false)
      
      // Reload settings from server
      setTimeout(async () => {
        await loadSettings()
      }, 500)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save grading settings')
      console.error('Error saving grading settings:', err)
    } finally {
      setSavingGrading(false)
    }
  }

  function handleGradingChange(field: 'pass_mark' | 'ca_weight' | 'exam_weight', value: number) {
    const newValues = { ...gradingValues, [field]: value }
    
    // Auto-adjust weights if CA or exam weight changed
    if (field === 'ca_weight') {
      newValues.exam_weight = 100 - value
    } else if (field === 'exam_weight') {
      newValues.ca_weight = 100 - value
    }
    
    setGradingValues(newValues)
    setGradingDirty(true)
  }

  async function saveCalendarSettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingCalendar(true)
    setError(null)
    setSuccess(null)

    try {
      // Save all calendar settings
      await updateSystemSetting('calendar.terms_per_year', calendarValues.terms_per_year, userId, userRole)
      await updateSystemSetting('calendar.default_term_length_weeks', calendarValues.default_term_length_weeks, userId, userRole)
      await updateSystemSetting('calendar.academic_year_start_month', calendarValues.academic_year_start_month, userId, userRole)
      
      setSuccess('Calendar settings saved successfully')
      setCalendarDirty(false)
      
      // Reload settings from server
      setTimeout(async () => {
        await loadSettings()
      }, 500)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save calendar settings')
      console.error('Error saving calendar settings:', err)
    } finally {
      setSavingCalendar(false)
    }
  }

  function handleCalendarChange(field: 'terms_per_year' | 'default_term_length_weeks' | 'academic_year_start_month', value: number) {
    setCalendarValues(prev => ({
      ...prev,
      [field]: value
    }))
    setCalendarDirty(true)
  }

  async function saveResultsSettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingResults(true)
    setError(null)
    setSuccess(null)

    try {
      // Save all results settings
      await updateSystemSetting('results.require_approval', resultsValues.require_approval, userId, userRole)
      await updateSystemSetting('results.parent_notification_enabled', resultsValues.parent_notification_enabled, userId, userRole)
      
      setSuccess('Results settings saved successfully')
      setResultsDirty(false)
      
      // Reload settings from server
      setTimeout(async () => {
        await loadSettings()
      }, 500)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save results settings')
      console.error('Error saving results settings:', err)
    } finally {
      setSavingResults(false)
    }
  }

  function handleResultsChange(field: 'require_approval' | 'parent_notification_enabled', value: boolean) {
    setResultsValues(prev => ({
      ...prev,
      [field]: value
    }))
    setResultsDirty(true)
  }

  async function saveSecuritySettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingSecurity(true)
    setError(null)
    setSuccess(null)

    try {
      // Save all security settings
      await updateSystemSetting('security.password_min_length', securityValues.password_min_length, userId, userRole)
      await updateSystemSetting('security.password_require_uppercase', securityValues.password_require_uppercase, userId, userRole)
      await updateSystemSetting('security.password_require_lowercase', securityValues.password_require_lowercase, userId, userRole)
      await updateSystemSetting('security.password_require_number', securityValues.password_require_number, userId, userRole)
      await updateSystemSetting('security.password_require_special', securityValues.password_require_special, userId, userRole)
      await updateSystemSetting('security.login_lockout_attempts', securityValues.login_lockout_attempts, userId, userRole)
      await updateSystemSetting('security.login_lockout_duration_minutes', securityValues.login_lockout_duration_minutes, userId, userRole)
      await updateSystemSetting('security.session_timeout_minutes', securityValues.session_timeout_minutes, userId, userRole)
      await updateSystemSetting('security.mfa_trusted_session_hours', securityValues.mfa_trusted_session_hours, userId, userRole)
      await updateSystemSetting('security.mfa_failure_spike_threshold_per_hour', securityValues.mfa_failure_spike_threshold_per_hour, userId, userRole)
      
      setSuccess('Security settings saved successfully')
      setSecurityDirty(false)
      
      // Reload settings from server
      setTimeout(async () => {
        await loadSettings()
      }, 500)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save security settings')
      console.error('Error saving security settings:', err)
    } finally {
      setSavingSecurity(false)
    }
  }

  function handleSecurityChange(field: keyof typeof securityValues, value: unknown) {
    setSecurityValues(prev => ({
      ...prev,
      [field]: value
    }))
    setSecurityDirty(true)
  }

  async function saveEmailSettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingEmail(true)
    setError(null)

    try {
      await updateSystemSetting('email.smtp_host', emailValues.smtp_host, userId, userRole)
      await updateSystemSetting('email.smtp_port', emailValues.smtp_port, userId, userRole)
      await updateSystemSetting('email.smtp_user', emailValues.smtp_user, userId, userRole)
      await updateSystemSetting('email.smtp_password', emailValues.smtp_password, userId, userRole)
      await updateSystemSetting('email.sender_name', emailValues.sender_name, userId, userRole)
      await updateSystemSetting('email.sender_email', emailValues.sender_email, userId, userRole)
      
      setSuccess('Email settings saved successfully')
      setEmailDirty(false)
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save email settings')
      console.error('Error saving email settings:', err)
    } finally {
      setSavingEmail(false)
    }
  }

  async function saveAISettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingAI(true)
    setError(null)
    setSuccess(null)

    try {
      const updates = [
        await updateSystemSetting('ai.default_provider', aiValues.default_provider, userId, userRole),
        await updateSystemSetting('ai.anthropic_model', aiValues.anthropic_model, userId, userRole),
        await updateSystemSetting('ai.openai_model', aiValues.openai_model, userId, userRole),
        await updateSystemSetting('ai.gemini_model', aiValues.gemini_model, userId, userRole),
      ]

      const failedUpdate = updates.find((result) => !result.success)
      if (failedUpdate) {
        throw new Error(failedUpdate.error || 'Failed to save AI settings')
      }

      if (aiValues.anthropic_api_key.trim()) {
        const result = await updateSystemSetting('ai.anthropic_api_key', aiValues.anthropic_api_key.trim(), userId, userRole)
        if (!result.success) {
          throw new Error(result.error || 'Failed to save Anthropic API key')
        }
      }

      if (aiValues.openai_api_key.trim()) {
        const result = await updateSystemSetting('ai.openai_api_key', aiValues.openai_api_key.trim(), userId, userRole)
        if (!result.success) {
          throw new Error(result.error || 'Failed to save OpenAI API key')
        }
      }

      if (aiValues.gemini_api_key.trim()) {
        const result = await updateSystemSetting('ai.gemini_api_key', aiValues.gemini_api_key.trim(), userId, userRole)
        if (!result.success) {
          throw new Error(result.error || 'Failed to save Gemini API key')
        }
      }

      setSuccess('AI settings saved successfully')
      setAIDirty(false)

      setTimeout(async () => {
        await loadSettings()
      }, 500)

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save AI settings')
      console.error('Error saving AI settings:', err)
    } finally {
      setSavingAI(false)
    }
  }

  async function saveMaintenanceSettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingMaintenance(true)
    setError(null)

    try {
      await updateSystemSetting('system.maintenance_mode_enabled', maintenanceValues.maintenance_mode_enabled, userId, userRole)
      await updateSystemSetting('system.maintenance_message', maintenanceValues.maintenance_message, userId, userRole)
      
      setSuccess('Maintenance settings saved successfully')
      setMaintenanceDirty(false)
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save maintenance settings')
      console.error('Error saving maintenance settings:', err)
    } finally {
      setSavingMaintenance(false)
    }
  }

  async function saveFeatureSettings() {
    if (!userId || !userRole) {
      setError('Not authenticated')
      return
    }

    setSavingFeatures(true)
    setError(null)

    try {
      const currentFeatureValues = featureValuesRef.current

      const updates = [
        await updateSystemSetting('features.enable_bulk_operations', currentFeatureValues.enable_bulk_operations, userId, userRole),
        await updateSystemSetting('features.enable_analytics', currentFeatureValues.enable_analytics, userId, userRole),
        await updateSystemSetting('features.enable_audit_logs', currentFeatureValues.enable_audit_logs, userId, userRole),
        await updateSystemSetting('features.enable_email_notifications', currentFeatureValues.enable_email_notifications, userId, userRole),
        await updateSystemSetting('features.enable_api_access', currentFeatureValues.enable_api_access, userId, userRole),
        await updateSystemSetting('features.enable_two_factor_auth', currentFeatureValues.enable_two_factor_auth, userId, userRole),
      ]

      const failedUpdate = updates.find((result) => !result.success)
      if (failedUpdate) {
        throw new Error(failedUpdate.error || 'Failed to save one or more feature settings')
      }
      
      setSuccess('Feature settings saved successfully')
      setFeatureDirty(false)

      setTimeout(async () => {
        await loadSettings()
      }, 500)
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save feature settings')
      console.error('Error saving feature settings:', err)
    } finally {
      setSavingFeatures(false)
    }
  }

  function getSetting(key: string): SystemSetting | undefined {
    return settings.find((s) => s.setting_key === key)
  }

  function getSettingValue(key: string, defaultValue: unknown = null): unknown {
    const setting = getSetting(key)
    if (!setting) return defaultValue
    
    // Handle boolean values stored as strings or actual booleans
    const value = setting.setting_value
    if (typeof value === 'string') {
      if (value === 'true') return true
      if (value === 'false') return false
    }
    
    return value !== undefined && value !== null ? value : defaultValue
  }

  function getBooleanSettingValue(key: string, defaultValue: boolean): boolean {
    const value = getSettingValue(key, defaultValue)
    return toBooleanSetting(value, defaultValue)
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
    <div className="space-y-6 overflow-x-clip">
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
        <TabsList className="w-full max-w-full">
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="grading">Grading</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
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
                { key: 'features.students_enabled', label: 'Students Module' },
                { key: 'features.parents_enabled', label: 'Parents Module' },
                { key: 'features.teachers_enabled', label: 'Teachers Module' },
                { key: 'features.analytics_enabled', label: 'Analytics Module' },
                { key: 'features.reports_enabled', label: 'Reports Module' },
                { key: 'features.announcements_enabled', label: 'Announcements Module' },
              ].map(({ key, label }) => {
                const setting = getSetting(key)
                const isEnabled = getBooleanSettingValue(key, true)

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
                  value={gradingValues.pass_mark}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      handleGradingChange('pass_mark', value)
                    }
                  }}
                  disabled={savingGrading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ca_weight">Continuous Assessment Weight (%)</Label>
                <Input
                  id="ca_weight"
                  type="number"
                  min="0"
                  max="100"
                  value={gradingValues.ca_weight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      handleGradingChange('ca_weight', value)
                    }
                  }}
                  disabled={savingGrading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam_weight">Exam Weight (%)</Label>
                <Input
                  id="exam_weight"
                  type="number"
                  min="0"
                  max="100"
                  value={gradingValues.exam_weight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                      handleGradingChange('exam_weight', value)
                    }
                  }}
                  disabled={savingGrading}
                />
              </div>

              <Alert>
                <SettingsIcon className="h-4 w-4" />
                <AlertDescription>
                  CA Weight + Exam Weight should equal 100%. Schools can customize these values after creation.
                </AlertDescription>
              </Alert>

              {gradingDirty && (
                <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You have unsaved changes
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={saveGradingSettings}
                  disabled={!gradingDirty || savingGrading}
                  className="w-full"
                >
                  {savingGrading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Grading Settings'
                  )}
                </Button>
              </div>
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
              {calendarDirty && (
                <Alert>
                  <AlertDescription>You have unsaved changes</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="terms_per_year">Terms Per Year</Label>
                <Input
                  id="terms_per_year"
                  type="number"
                  min="1"
                  max="4"
                  value={calendarValues.terms_per_year}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 1 && value <= 4) {
                      handleCalendarChange('terms_per_year', value)
                    }
                  }}
                  disabled={savingCalendar}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeks_per_term">Weeks Per Term</Label>
                <Input
                  id="weeks_per_term"
                  type="number"
                  min="1"
                  max="20"
                  value={calendarValues.default_term_length_weeks}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 1 && value <= 20) {
                      handleCalendarChange('default_term_length_weeks', value)
                    }
                  }}
                  disabled={savingCalendar}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academic_year_start">Academic Year Start Month</Label>
                <select
                  id="academic_year_start"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={calendarValues.academic_year_start_month}
                  onChange={(e) => handleCalendarChange('academic_year_start_month', parseInt(e.target.value))}
                  disabled={savingCalendar}
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
              <Button
                onClick={saveCalendarSettings}
                disabled={!calendarDirty || savingCalendar}
                className="w-full"
              >
                {savingCalendar ? 'Saving...' : 'Save Calendar Settings'}
              </Button>
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
              {resultsDirty && (
                <Alert>
                  <AlertDescription>You have unsaved changes</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <Label htmlFor="require_approval">Require Admin Approval Before Publishing</Label>
                  <p className="text-sm text-muted-foreground">Results must be approved before visibility to students/parents</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_approval"
                    checked={resultsValues.require_approval}
                    onCheckedChange={(checked: boolean) => handleResultsChange('require_approval', checked)}
                    disabled={savingResults}
                  />
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
                    checked={resultsValues.parent_notification_enabled}
                    onCheckedChange={(checked: boolean) => handleResultsChange('parent_notification_enabled', checked)}
                    disabled={savingResults}
                  />
                </div>
              </div>
              <Button
                onClick={saveResultsSettings}
                disabled={!resultsDirty || savingResults}
                className="w-full"
              >
                {savingResults ? 'Saving...' : 'Save Results Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          {securityDirty && (
            <Alert>
              <AlertDescription>You have unsaved changes</AlertDescription>
            </Alert>
          )}
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
                  value={securityValues.password_min_length}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 6 && value <= 20) {
                      handleSecurityChange('password_min_length', value)
                    }
                  }}
                  disabled={savingSecurity}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_uppercase">Require Uppercase Letter</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_uppercase"
                    checked={securityValues.password_require_uppercase}
                    onCheckedChange={(checked: boolean) => handleSecurityChange('password_require_uppercase', checked)}
                    disabled={savingSecurity}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_lowercase">Require Lowercase Letter</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_lowercase"
                    checked={securityValues.password_require_lowercase}
                    onCheckedChange={(checked: boolean) => handleSecurityChange('password_require_lowercase', checked)}
                    disabled={savingSecurity}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_number">Require Number</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_number"
                    checked={securityValues.password_require_number}
                    onCheckedChange={(checked: boolean) => handleSecurityChange('password_require_number', checked)}
                    disabled={savingSecurity}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="require_special">Require Special Character</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="require_special"
                    checked={securityValues.password_require_special}
                    onCheckedChange={(checked: boolean) => handleSecurityChange('password_require_special', checked)}
                    disabled={savingSecurity}
                  />
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
                  value={securityValues.login_lockout_attempts}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 3 && value <= 10) {
                      handleSecurityChange('login_lockout_attempts', value)
                    }
                  }}
                  disabled={savingSecurity}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lockout_duration">Account Lockout Duration (minutes)</Label>
                <Input
                  id="lockout_duration"
                  type="number"
                  min="5"
                  max="120"
                  value={securityValues.login_lockout_duration_minutes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 5 && value <= 120) {
                      handleSecurityChange('login_lockout_duration_minutes', value)
                    }
                  }}
                  disabled={savingSecurity}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  min="15"
                  max="480"
                  value={securityValues.session_timeout_minutes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 15 && value <= 480) {
                      handleSecurityChange('session_timeout_minutes', value)
                    }
                  }}
                  disabled={savingSecurity}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa_trusted_hours">MFA Trusted Session Duration (hours)</Label>
                <Input
                  id="mfa_trusted_hours"
                  type="number"
                  min="1"
                  max="168"
                  value={securityValues.mfa_trusted_session_hours}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 1 && value <= 168) {
                      handleSecurityChange('mfa_trusted_session_hours', value)
                    }
                  }}
                  disabled={savingSecurity}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa_spike_threshold">MFA Failure Spike Alert Threshold (per hour)</Label>
                <Input
                  id="mfa_spike_threshold"
                  type="number"
                  min="2"
                  max="50"
                  value={securityValues.mfa_failure_spike_threshold_per_hour}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 2 && value <= 50) {
                      handleSecurityChange('mfa_failure_spike_threshold_per_hour', value)
                    }
                  }}
                  disabled={savingSecurity}
                />
              </div>
              <Button
                onClick={saveSecuritySettings}
                disabled={!securityDirty || savingSecurity}
                className="w-full"
              >
                {savingSecurity ? 'Saving...' : 'Save Security Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Configuration Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>Configure SMTP settings for system email notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  type="text"
                  placeholder="mail.example.com"
                  value={emailValues.smtp_host}
                  onChange={(e) => {
                    setEmailValues({ ...emailValues, smtp_host: e.target.value })
                    setEmailDirty(true)
                  }}
                  disabled={savingEmail}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={emailValues.smtp_port}
                    onChange={(e) => {
                      setEmailValues({ ...emailValues, smtp_port: parseInt(e.target.value) || 587 })
                      setEmailDirty(true)
                    }}
                    disabled={savingEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_user">SMTP Username</Label>
                  <Input
                    id="smtp_user"
                    type="text"
                    placeholder="username"
                    value={emailValues.smtp_user}
                    onChange={(e) => {
                      setEmailValues({ ...emailValues, smtp_user: e.target.value })
                      setEmailDirty(true)
                    }}
                    disabled={savingEmail}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  placeholder="••••••••"
                  value={emailValues.smtp_password}
                  onChange={(e) => {
                    setEmailValues({ ...emailValues, smtp_password: e.target.value })
                    setEmailDirty(true)
                  }}
                  disabled={savingEmail}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_name">Sender Name</Label>
                <Input
                  id="sender_name"
                  type="text"
                  value={emailValues.sender_name}
                  onChange={(e) => {
                    setEmailValues({ ...emailValues, sender_name: e.target.value })
                    setEmailDirty(true)
                  }}
                  disabled={savingEmail}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_email">Sender Email Address</Label>
                <Input
                  id="sender_email"
                  type="email"
                  value={emailValues.sender_email}
                  onChange={(e) => {
                    setEmailValues({ ...emailValues, sender_email: e.target.value })
                    setEmailDirty(true)
                  }}
                  disabled={savingEmail}
                />
              </div>

              <Button
                onClick={saveEmailSettings}
                disabled={!emailDirty || savingEmail}
                className="w-full"
              >
                {savingEmail ? 'Saving...' : 'Save Email Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Provider Tab */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                AI Provider Configuration
              </CardTitle>
              <CardDescription>
                Configure multi-AI support. This section is restricted to sysadmins and is protected by the super-admin route.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <SettingsIcon className="h-4 w-4" />
                <AlertDescription>
                  Leave an API key field blank to keep the current stored key. The active provider is used first, with fallback to the remaining configured providers.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="ai_provider">Default AI Provider</Label>
                <select
                  id="ai_provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={aiValues.default_provider}
                  onChange={(e) => {
                    setAIValues({ ...aiValues, default_provider: e.target.value as 'anthropic' | 'openai' | 'gemini' })
                    setAIDirty(true)
                  }}
                  disabled={savingAI}
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { key: 'anthropic', label: 'Anthropic', keyField: 'anthropic_api_key', modelField: 'anthropic_model', modelPlaceholder: 'claude-3-5-sonnet-20241022' },
                  { key: 'openai', label: 'OpenAI', keyField: 'openai_api_key', modelField: 'openai_model', modelPlaceholder: 'gpt-4o-mini' },
                  { key: 'gemini', label: 'Gemini', keyField: 'gemini_api_key', modelField: 'gemini_model', modelPlaceholder: 'gemini-1.5-pro' },
                ].map((provider) => {
                  const isConfigured = aiConfigured[provider.key as keyof typeof aiConfigured]

                  return (
                    <Card key={provider.key} className="border-dashed">
                      <CardHeader>
                        <CardTitle className="text-base">{provider.label}</CardTitle>
                        <CardDescription>{isConfigured ? 'API key stored securely' : 'API key not configured yet'}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={provider.keyField}>API Key</Label>
                          <Input
                            id={provider.keyField}
                            type="password"
                            placeholder={isConfigured ? '••••••••••••••••' : 'Enter API key'}
                            value={aiValues[provider.keyField as keyof typeof aiValues] as string}
                            onChange={(e) => {
                              setAIValues({ ...aiValues, [provider.keyField]: e.target.value })
                              setAIDirty(true)
                            }}
                            disabled={savingAI}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={provider.modelField}>Model</Label>
                          <Input
                            id={provider.modelField}
                            type="text"
                            placeholder={provider.modelPlaceholder}
                            value={aiValues[provider.modelField as keyof typeof aiValues] as string}
                            onChange={(e) => {
                              setAIValues({ ...aiValues, [provider.modelField]: e.target.value })
                              setAIDirty(true)
                            }}
                            disabled={savingAI}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {aiDirty && (
                <Alert>
                  <AlertDescription>You have unsaved AI configuration changes</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={saveAISettings}
                disabled={!aiDirty || savingAI}
                className="w-full"
              >
                {savingAI ? 'Saving...' : 'Save AI Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Mode Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>Put the system in maintenance mode to prevent user access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/20">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Enable Maintenance Mode</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Users will see a maintenance message and cannot access the system</p>
                </div>
                <Switch
                  checked={maintenanceValues.maintenance_mode_enabled}
                  onCheckedChange={(checked) => {
                    setMaintenanceValues({ ...maintenanceValues, maintenance_mode_enabled: checked })
                    setMaintenanceDirty(true)
                  }}
                  disabled={savingMaintenance}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance_message">Maintenance Message</Label>
                <textarea
                  id="maintenance_message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={maintenanceValues.maintenance_message}
                  onChange={(e) => {
                    setMaintenanceValues({ ...maintenanceValues, maintenance_message: e.target.value })
                    setMaintenanceDirty(true)
                  }}
                  disabled={savingMaintenance}
                  placeholder="Enter the message users will see during maintenance..."
                />
              </div>

              <Button
                onClick={saveMaintenanceSettings}
                disabled={!maintenanceDirty || savingMaintenance}
                className="w-full"
              >
                {savingMaintenance ? 'Saving...' : 'Save Maintenance Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>Enable or disable platform features globally</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[
                  { key: 'enable_bulk_operations', label: 'Bulk Operations', description: 'Allow bulk import/export operations' },
                  { key: 'enable_analytics', label: 'Analytics', description: 'Enable platform analytics and reporting' },
                  { key: 'enable_audit_logs', label: 'Audit Logging', description: 'Track all system actions' },
                  { key: 'enable_email_notifications', label: 'Email Notifications', description: 'Send email notifications to users' },
                  { key: 'enable_api_access', label: 'API Access', description: 'Allow third-party API access' },
                  { key: 'enable_two_factor_auth', label: 'Two-Factor Authentication', description: 'Require 2FA for accounts' },
                ].map((feature) => (
                  <div key={feature.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">{feature.label}</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>
                    </div>
                    <Switch
                      checked={featureValues[feature.key as keyof typeof featureValues]}
                      onCheckedChange={(checked) => {
                        setFeatureValues((prev) => {
                          const nextValues = { ...prev, [feature.key]: checked }
                          featureValuesRef.current = nextValues
                          return nextValues
                        })
                        setFeatureDirty(true)
                      }}
                      disabled={savingFeatures}
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={saveFeatureSettings}
                disabled={!featureDirty || savingFeatures}
                className="w-full"
              >
                {savingFeatures ? 'Saving...' : 'Save Feature Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Backup & Restore Section */}
          <Card>
            <CardHeader>
              <CardTitle>Backup & System Management</CardTitle>
              <CardDescription>Manage system backups and maintenance tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  disabled={backupLoading}
                  className="w-full"
                >
                  {backupLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    'Create Database Backup'
                  )}
                </Button>
                <Button
                  variant="outline"
                  disabled={backupLoading}
                  className="w-full"
                >
                  Download Backup
                </Button>
              </div>
              <Button
                variant="outline"
                disabled={backupLoading}
                className="w-full"
              >
                Clear Cache
              </Button>
              <p className="text-xs text-gray-500 mt-4">
                Last backup: Never • Backup frequency: Daily (automatic)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
