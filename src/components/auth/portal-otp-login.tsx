'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Mail, ArrowRight, Clock } from 'lucide-react'
import { getClientCsrfHeaders } from '@/lib/csrf'

export interface PortalOtpLoginProps {
  identifier: string
  onIdentifierChange: (value: string) => void
  onBackToPassword: () => void
}

type OtpState = 'send' | 'verify'

export function PortalOtpLogin({ identifier, onIdentifierChange, onBackToPassword }: PortalOtpLoginProps) {
  const [state, setState] = useState<OtpState>('send')
  const [code, setCode] = useState('')
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)

    try {
      if (!identifier || !identifier.trim()) {
        throw new Error('Please enter your email or student/staff ID')
      }

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          action: 'send',
          identifier: identifier.trim(),
          channel,
        }),
      })

      const payload = (await response.json()) as { 
        success?: boolean
        message?: string
        error?: string
        expiresAt?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send OTP code')
      }

      setMessage(payload.message || 'OTP code sent successfully!')
      if (payload.expiresAt) {
        setExpiresAt(payload.expiresAt)
      }
      setState('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)

    try {
      if (!code || !code.trim()) {
        throw new Error('Please enter the OTP code')
      }

      if (code.length !== 6 || !/^\d+$/.test(code)) {
        throw new Error('OTP code must be 6 digits')
      }

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: getClientCsrfHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          action: 'verify',
          identifier: identifier.trim(),
          channel,
          code: code.trim(),
        }),
      })

      const payload = (await response.json()) as {
        success?: boolean
        message?: string
        error?: string
        user?: { id: string; email: string; role: string; schoolId: string | null }
        attemptsRemaining?: number
      }

      if (!response.ok) {
        if (payload.attemptsRemaining !== undefined) {
          setAttemptsRemaining(payload.attemptsRemaining)
        }
        throw new Error(payload.error || 'Failed to verify OTP code')
      }

      setMessage(payload.message || 'OTP verified successfully!')
      
      if (payload.user) {
        // Store verified user info in session storage temporarily
        sessionStorage.setItem('otpVerifiedUser', JSON.stringify(payload.user))
        
        // Redirect to dashboard or next step
        // For now, just show success message
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          {state === 'send' ? 'Email Verification' : 'Enter Your Code'}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {state === 'send'
            ? 'Receive a one-time code via email'
            : 'Check your email for the verification code'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <AlertDescription className="text-green-800 dark:text-green-200">{message}</AlertDescription>
        </Alert>
      )}

      {state === 'send' ? (
        <form onSubmit={handleSendOtp} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp-email" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Email or Student/Staff ID
            </Label>
            <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
              <Mail className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
              <Input
                id="otp-email"
                type="text"
                value={identifier}
                onChange={(e) => onIdentifierChange(e.target.value)}
                placeholder="student@example.com or ADM-000-000"
                className="h-12 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter the email or ID associated with your account
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Delivery Method
            </Label>
            <div className="flex gap-3">
              <label className="flex flex-1 items-center gap-3 rounded-xl border-2 p-3 transition-all cursor-pointer" style={{
                borderColor: channel === 'email' ? '#1e293b' : '#e2e8f0',
              }}>
                <input
                  type="radio"
                  name="channel"
                  value="email"
                  checked={channel === 'email'}
                  onChange={() => setChannel('email')}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
              </label>
              <label className="flex flex-1 items-center gap-3 rounded-xl border-2 p-3 transition-all cursor-pointer opacity-50">
                <input
                  type="radio"
                  name="channel"
                  value="sms"
                  disabled
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">SMS (Coming Soon)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBackToPassword}
              className="flex-1 h-12 rounded-full"
              disabled={isLoading}
            >
              Back to Password
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 h-12 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold hover:scale-[1.01] active:scale-[0.99]"
            >
              <span className="flex items-center justify-center gap-2">
                {isLoading ? 'Sending...' : 'Send Code'}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp-code" className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Verification Code
            </Label>
            <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-100 px-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-slate-200/20">
              <Lock className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-300" />
              <Input
                id="otp-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="h-12 border-0 bg-transparent px-0 text-center text-2xl font-bold tracking-widest text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="h-3 w-3" />
              <span>Code expires in 10 minutes</span>
            </div>
          </div>

          {attemptsRemaining !== null && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Check your email for the 6-digit code sent to <strong>{identifier}</strong>
          </p>

          <div className="flex gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setState('send')
                setCode('')
                setError('')
                setMessage('')
              }}
              className="flex-1 h-12 rounded-full"
              disabled={isLoading}
            >
              Resend Code
            </Button>
            <Button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="flex-1 h-12 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-2">
                {isLoading ? 'Verifying...' : 'Verify Code'}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
