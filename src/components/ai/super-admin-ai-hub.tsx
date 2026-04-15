'use client'

import { useState } from 'react'
import { Bot, Code2, ShieldAlert, ShieldCheck, Send, Save, GitBranch, MessageSquare, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updateSystemSetting } from '@/app/(dashboard)/dashboard/super-admin/settings/actions'

type AssistantTab = 'general' | 'coding' | 'cyber' | 'auditor'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const TAB_META: Record<AssistantTab, { label: string; icon: typeof Bot; placeholder: string }> = {
  general: {
    label: 'AI Chat',
    icon: Bot,
    placeholder: 'Ask about platform operations, integrations, roadmap, or governance...',
  },
  coding: {
    label: 'Coding Assistant',
    icon: Code2,
    placeholder: 'Ask for implementation guidance, migrations, tests, or refactors...',
  },
  cyber: {
    label: 'Cyber Expert',
    icon: ShieldCheck,
    placeholder: 'Ask for threat modeling, hardening recommendations, and controls...',
  },
  auditor: {
    label: 'External Security Auditor',
    icon: ShieldAlert,
    placeholder: 'Request findings, severity analysis, and remediation plans...',
  },
}

export function SuperAdminAIHub() {
  const [activeTab, setActiveTab] = useState<AssistantTab>('general')
  const [messagesByTab, setMessagesByTab] = useState<Record<AssistantTab, Message[]>>({
    general: [],
    coding: [],
    cyber: [],
    auditor: [],
  })
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [executionLoading, setExecutionLoading] = useState(false)

  const [githubSyncInput, setGithubSyncInput] = useState({
    filePath: 'docs/ai-generated-note.md',
    commitMessage: 'chore: update AI generated note',
    content: '# AI Generated Note\n\nUpdated by SmartSBA AI Hub.',
    requestedMode: 'direct_commit' as 'direct_commit' | 'pr_only',
    filesJson: '[\n  {"filePath":"docs/ai-generated-note.md","content":"# AI Generated Note\\n\\nUpdated by SmartSBA AI Hub."}\n]',
  })

  const [twilioTestInput, setTwilioTestInput] = useState({
    to: '',
    body: 'SmartSBA AI Hub test SMS',
    schoolId: '',
    dryRun: true,
    queue: true,
  })

  const [securityCheckInput, setSecurityCheckInput] = useState({
    target: 'manual-input',
    content: '',
    includeAIAdvisory: true,
  })

  const [executionResult, setExecutionResult] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<Array<{ id: string; target: string | null; summary: { total?: number; high?: number; medium?: number; low?: number }; created_at: string }>>([])

  const [setupValues, setSetupValues] = useState({
    githubToken: '',
    githubRepoOwner: '',
    githubRepoName: '',
    githubProdMode: 'pr_only',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioMessagingServiceSid: '',
    twilioGlobalFromNumber: '',
    twilioPerSchoolEnabled: false,
    securityRuleEngineEnabled: true,
  })

  const sendPrompt = async () => {
    if (!prompt.trim() || loading) return

    setLoading(true)
    setError(null)

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: prompt,
    }

    setMessagesByTab((prev) => ({
      ...prev,
      [activeTab]: [...prev[activeTab], userMessage],
    }))

    const currentPrompt = prompt
    setPrompt('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('You must be logged in to use AI assistant')
      }

      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          assistantMode: activeTab,
          maxTokens: 1000,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || 'AI request failed')
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: payload.result?.next_steps?.[0] || payload.message || 'No response generated.',
      }

      setMessagesByTab((prev) => ({
        ...prev,
        [activeTab]: [...prev[activeTab], assistantMessage],
      }))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to send prompt'
      setError(message)
      setMessagesByTab((prev) => ({
        ...prev,
        [activeTab]: [
          ...prev[activeTab],
          {
            id: `${Date.now()}-error`,
            role: 'assistant',
            content: 'I could not process that request. Please try again.',
          },
        ],
      }))
    } finally {
      setLoading(false)
    }
  }

  const saveSetup = async () => {
    setSaveStatus(null)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        throw new Error('You must be logged in to save setup values.')
      }

      const userId = session.user.id
      const userRole = 'super_admin'

      const updates: Array<[string, unknown]> = [
        ['github.token', setupValues.githubToken],
        ['github.repo_owner', setupValues.githubRepoOwner],
        ['github.repo_name', setupValues.githubRepoName],
        ['github.prod_mode', setupValues.githubProdMode],
        ['twilio.account_sid', setupValues.twilioAccountSid],
        ['twilio.auth_token', setupValues.twilioAuthToken],
        ['twilio.messaging_service_sid', setupValues.twilioMessagingServiceSid],
        ['twilio.global_from_number', setupValues.twilioGlobalFromNumber],
        ['twilio.per_school_enabled', setupValues.twilioPerSchoolEnabled],
        ['security.rule_engine_enabled', setupValues.securityRuleEngineEnabled],
      ]

      for (const [key, value] of updates) {
        const result = await updateSystemSetting(key, value, userId, userRole)
        if (!result.success) {
          throw new Error(result.error || `Failed to update ${key}`)
        }
      }

      setSaveStatus('Setup values saved successfully.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save setup values.')
    }
  }

  const runGitHubSync = async () => {
    setExecutionLoading(true)
    setError(null)
    setExecutionResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('You must be logged in to execute GitHub sync.')
      }

      let files: Array<{ filePath: string; content: string }> | undefined
      try {
        files = JSON.parse(githubSyncInput.filesJson) as Array<{ filePath: string; content: string }>
      } catch {
        files = undefined
      }

      const response = await fetch('/api/super-admin/github/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filePath: githubSyncInput.filePath,
          content: githubSyncInput.content,
          files,
          commitMessage: githubSyncInput.commitMessage,
          requestedMode: githubSyncInput.requestedMode,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'GitHub sync failed')
      }

      const result = payload.result as {
        mode: string
        branch: string
        commitSha?: string
        pullRequestUrl?: string
      }

      setExecutionResult(
        `GitHub sync completed in ${result.mode} mode on branch ${result.branch}.` +
          ` Files updated: ${(result as { filesUpdated?: number }).filesUpdated || 1}.` +
          (result.pullRequestUrl ? ` PR: ${result.pullRequestUrl}` : '')
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GitHub sync execution failed')
    } finally {
      setExecutionLoading(false)
    }
  }

  const runTwilioSend = async () => {
    setExecutionLoading(true)
    setError(null)
    setExecutionResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('You must be logged in to run Twilio send/test.')
      }

      const response = await fetch('/api/super-admin/twilio/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: twilioTestInput.to,
          body: twilioTestInput.body,
          schoolId: twilioTestInput.schoolId || undefined,
          dryRun: twilioTestInput.dryRun,
          queue: twilioTestInput.queue,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Twilio send/test failed')
      }

      if (payload.dryRun) {
        setExecutionResult(`Twilio dry-run sender resolved from ${payload.sender?.source}.`) 
      } else if (payload.queued) {
        setExecutionResult(`Twilio SMS queued successfully. Queue ID: ${payload.queueId}`)
      } else {
        setExecutionResult(`Twilio SMS sent successfully. SID: ${payload.result?.sid || 'unknown'}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Twilio send/test failed')
    } finally {
      setExecutionLoading(false)
    }
  }

  const runSecurityChecks = async () => {
    setExecutionLoading(true)
    setError(null)
    setExecutionResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('You must be logged in to run security rule checks.')
      }

      const response = await fetch('/api/super-admin/security/rule-checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(securityCheckInput),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Security rule checks failed')
      }

      const summary = payload.result?.summary
      setExecutionResult(
        `Security rule checks completed. Run ID: ${payload.runId || 'n/a'}. Total=${summary?.total ?? 0}, High=${summary?.high ?? 0}, Medium=${summary?.medium ?? 0}, Low=${summary?.low ?? 0}.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Security checks failed')
    } finally {
      setExecutionLoading(false)
    }
  }

  const processTwilioQueueNow = async () => {
    setExecutionLoading(true)
    setError(null)
    setExecutionResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('You must be logged in to process Twilio queue.')
      }

      const response = await fetch('/api/super-admin/twilio/queue/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ batchSize: 20 }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Twilio queue processing failed')
      }

      const result = payload.result as { processed: number; sent: number; failed: number; retried: number }
      setExecutionResult(
        `Twilio queue processed: processed=${result.processed}, sent=${result.sent}, failed=${result.failed}, retried=${result.retried}.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Twilio queue processing failed')
    } finally {
      setExecutionLoading(false)
    }
  }

  const loadSecurityHistory = async () => {
    setExecutionLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('You must be logged in to load security history.')
      }

      const response = await fetch('/api/super-admin/security/rule-checks/history?limit=10', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load security history')
      }

      setHistoryRows((payload.runs || []) as Array<{ id: string; target: string | null; summary: { total?: number; high?: number; medium?: number; low?: number }; created_at: string }>)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load security history')
    } finally {
      setExecutionLoading(false)
    }
  }

  const ActiveIcon = TAB_META[activeTab].icon

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Command Center</h1>
        <p className="text-muted-foreground mt-1">
          SysAdmin AI hub for chat, coding assistance, cyber analysis, external auditing, and integrations setup.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AssistantTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">AI Chat</TabsTrigger>
          <TabsTrigger value="coding">Coding</TabsTrigger>
          <TabsTrigger value="cyber">Cyber</TabsTrigger>
          <TabsTrigger value="auditor">Auditor</TabsTrigger>
        </TabsList>

        {(Object.keys(TAB_META) as AssistantTab[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = TAB_META[tab].icon
                    return <Icon className="h-5 w-5" />
                  })()}
                  {TAB_META[tab].label}
                </CardTitle>
                <CardDescription>
                  {tab === 'general' && 'Platform operations, governance, integrations, and planning.'}
                  {tab === 'coding' && 'Architecture-safe coding guidance, migrations, tests, and implementation steps.'}
                  {tab === 'cyber' && 'Threat modeling, hardening controls, and security remediation guidance.'}
                  {tab === 'auditor' && 'External-style findings with severity and concrete remediation priorities.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[420px] overflow-y-auto rounded-md border p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                  {messagesByTab[tab].length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Start by asking your first question in {TAB_META[tab].label.toLowerCase()} mode.
                    </p>
                  ) : (
                    messagesByTab[tab].map((message) => (
                      <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 border'
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {activeTab === tab && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ActiveIcon className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">{TAB_META[activeTab].label}</span>
                    </div>
                    <div className="flex gap-2">
                      <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={TAB_META[activeTab].placeholder}
                        className="min-h-[90px]"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={sendPrompt} disabled={loading || !prompt.trim()} className="gap-2">
                        <Send className="h-4 w-4" />
                        {loading ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Integrations Setup</CardTitle>
          <CardDescription>
            Configure GitHub sync, Twilio SMS, and security rule engine defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="github-token">GitHub Token</Label>
              <Input
                id="github-token"
                type="password"
                value={setupValues.githubToken}
                onChange={(e) => setSetupValues((v) => ({ ...v, githubToken: e.target.value }))}
                placeholder="ghp_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-owner">GitHub Repo Owner</Label>
              <Input
                id="github-owner"
                value={setupValues.githubRepoOwner}
                onChange={(e) => setSetupValues((v) => ({ ...v, githubRepoOwner: e.target.value }))}
                placeholder="org-or-user"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-repo">GitHub Repo Name</Label>
              <Input
                id="github-repo"
                value={setupValues.githubRepoName}
                onChange={(e) => setSetupValues((v) => ({ ...v, githubRepoName: e.target.value }))}
                placeholder="repository"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-mode">GitHub Prod Mode</Label>
              <Input
                id="github-mode"
                value={setupValues.githubProdMode}
                onChange={(e) => setSetupValues((v) => ({ ...v, githubProdMode: e.target.value }))}
                placeholder="pr_only"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Twilio Account SID</Label>
              <Input
                id="twilio-account-sid"
                value={setupValues.twilioAccountSid}
                onChange={(e) => setSetupValues((v) => ({ ...v, twilioAccountSid: e.target.value }))}
                placeholder="AC..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Twilio Auth Token</Label>
              <Input
                id="twilio-auth-token"
                type="password"
                value={setupValues.twilioAuthToken}
                onChange={(e) => setSetupValues((v) => ({ ...v, twilioAuthToken: e.target.value }))}
                placeholder="Twilio auth token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-messaging-service-sid">Twilio Messaging Service SID</Label>
              <Input
                id="twilio-messaging-service-sid"
                value={setupValues.twilioMessagingServiceSid}
                onChange={(e) => setSetupValues((v) => ({ ...v, twilioMessagingServiceSid: e.target.value }))}
                placeholder="MG..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-global-from">Twilio Global From Number</Label>
              <Input
                id="twilio-global-from"
                value={setupValues.twilioGlobalFromNumber}
                onChange={(e) => setSetupValues((v) => ({ ...v, twilioGlobalFromNumber: e.target.value }))}
                placeholder="+15551234567"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant={setupValues.twilioPerSchoolEnabled ? 'default' : 'outline'}
              onClick={() => setSetupValues((v) => ({ ...v, twilioPerSchoolEnabled: !v.twilioPerSchoolEnabled }))}
            >
              Per-school Twilio Senders: {setupValues.twilioPerSchoolEnabled ? 'Enabled' : 'Disabled'}
            </Button>
            <Button
              variant={setupValues.securityRuleEngineEnabled ? 'default' : 'outline'}
              onClick={() => setSetupValues((v) => ({ ...v, securityRuleEngineEnabled: !v.securityRuleEngineEnabled }))}
            >
              Security Rule Engine: {setupValues.securityRuleEngineEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {saveStatus && <p className="text-sm text-green-600 dark:text-green-400">{saveStatus}</p>}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
            <Button onClick={saveSetup} className="gap-2">
              <Save className="h-4 w-4" />
              Save Setup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution Layer</CardTitle>
          <CardDescription>
            Run GitHub sync (hybrid mode policy), Twilio sender routing test/send, and rule-based security checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <GitBranch className="h-4 w-4" />
                GitHub Sync
              </div>
              <Input
                value={githubSyncInput.filePath}
                onChange={(e) => setGithubSyncInput((v) => ({ ...v, filePath: e.target.value }))}
                placeholder="file path"
              />
              <Input
                value={githubSyncInput.commitMessage}
                onChange={(e) => setGithubSyncInput((v) => ({ ...v, commitMessage: e.target.value }))}
                placeholder="commit message"
              />
              <Textarea
                value={githubSyncInput.content}
                onChange={(e) => setGithubSyncInput((v) => ({ ...v, content: e.target.value }))}
                className="min-h-[110px]"
              />
              <Textarea
                value={githubSyncInput.filesJson}
                onChange={(e) => setGithubSyncInput((v) => ({ ...v, filesJson: e.target.value }))}
                className="min-h-[110px]"
                placeholder="Optional JSON array for batched files"
              />
              <Input
                value={githubSyncInput.requestedMode}
                onChange={(e) =>
                  setGithubSyncInput((v) => ({
                    ...v,
                    requestedMode: e.target.value === 'pr_only' ? 'pr_only' : 'direct_commit',
                  }))
                }
                placeholder="requested mode (direct_commit/pr_only)"
              />
              <Button onClick={runGitHubSync} disabled={executionLoading} className="w-full">
                Execute GitHub Sync
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                Twilio Runtime Routing
              </div>
              <Input
                value={twilioTestInput.to}
                onChange={(e) => setTwilioTestInput((v) => ({ ...v, to: e.target.value }))}
                placeholder="recipient number e.g. +15551234567"
              />
              <Textarea
                value={twilioTestInput.body}
                onChange={(e) => setTwilioTestInput((v) => ({ ...v, body: e.target.value }))}
                className="min-h-[110px]"
              />
              <Input
                value={twilioTestInput.schoolId}
                onChange={(e) => setTwilioTestInput((v) => ({ ...v, schoolId: e.target.value }))}
                placeholder="optional school id for sender override"
              />
              <Button
                variant={twilioTestInput.dryRun ? 'default' : 'outline'}
                onClick={() => setTwilioTestInput((v) => ({ ...v, dryRun: !v.dryRun }))}
                className="w-full"
              >
                Mode: {twilioTestInput.dryRun ? 'Dry Run (resolve sender)' : 'Send SMS'}
              </Button>
              <Button
                variant={twilioTestInput.queue ? 'default' : 'outline'}
                onClick={() => setTwilioTestInput((v) => ({ ...v, queue: !v.queue }))}
                className="w-full"
              >
                Queue Mode: {twilioTestInput.queue ? 'Enabled' : 'Disabled'}
              </Button>
              <Button onClick={runTwilioSend} disabled={executionLoading} className="w-full">
                Run Twilio Action
              </Button>
              <Button onClick={processTwilioQueueNow} disabled={executionLoading} className="w-full" variant="outline">
                Process Queue Now
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                Security Rule Checks
              </div>
              <Input
                value={securityCheckInput.target}
                onChange={(e) => setSecurityCheckInput((v) => ({ ...v, target: e.target.value }))}
                placeholder="target label (file/service)"
              />
              <Textarea
                value={securityCheckInput.content}
                onChange={(e) => setSecurityCheckInput((v) => ({ ...v, content: e.target.value }))}
                className="min-h-[160px]"
                placeholder="Paste code/config/log content to evaluate"
              />
              <Button
                variant={securityCheckInput.includeAIAdvisory ? 'default' : 'outline'}
                onClick={() => setSecurityCheckInput((v) => ({ ...v, includeAIAdvisory: !v.includeAIAdvisory }))}
                className="w-full"
              >
                AI Advisory: {securityCheckInput.includeAIAdvisory ? 'Enabled' : 'Disabled'}
              </Button>
              <Button onClick={runSecurityChecks} disabled={executionLoading || !securityCheckInput.content.trim()} className="w-full">
                Run Rule Checks
              </Button>
              <Button onClick={loadSecurityHistory} disabled={executionLoading} className="w-full" variant="outline">
                Load Security History
              </Button>
            </div>
          </div>

          {historyRows.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Recent Security Rule Runs</p>
              <div className="space-y-2">
                {historyRows.map((row) => (
                  <div key={row.id} className="rounded border p-2 text-xs">
                    <p><strong>Target:</strong> {row.target || 'n/a'}</p>
                    <p>
                      <strong>Summary:</strong> total={row.summary?.total || 0}, high={row.summary?.high || 0}, medium={row.summary?.medium || 0}, low={row.summary?.low || 0}
                    </p>
                    <p><strong>Created:</strong> {new Date(row.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(executionResult || error) && (
            <div className="rounded-md border p-3 text-sm">
              {executionResult && <p className="text-green-700 dark:text-green-300">{executionResult}</p>}
              {error && <p className="text-red-700 dark:text-red-300">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
