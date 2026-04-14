"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

interface SessionTimeoutProviderProps {
  children: React.ReactNode
  timeoutMinutes?: number
  warningMinutes?: number
}

const DEFAULT_TIMEOUT_MINUTES = 60
const DEFAULT_WARNING_MINUTES = 5
const ACTIVITY_EVENTS = ['click', 'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function SessionTimeoutProvider({
  children,
  timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
  warningMinutes = DEFAULT_WARNING_MINUTES,
}: SessionTimeoutProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const lastActivityRef = useRef(Date.now())
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMountedRef = useRef(false)

  const timeoutMs = useMemo(() => Math.max(1, timeoutMinutes) * 60_000, [timeoutMinutes])
  const warningMs = useMemo(() => Math.max(1, Math.min(warningMinutes, timeoutMinutes - 1)) * 60_000, [warningMinutes, timeoutMinutes])

  const clearTimers = () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
  }

  const signOutAndRedirect = async () => {
    clearTimers()
    setShowWarning(false)
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore sign-out errors; session should still be treated as expired
    }
    router.push('/login')
    router.refresh()
  }

  const scheduleTimers = () => {
    clearTimers()
    if (!isAuthenticated) return

    const elapsed = Date.now() - lastActivityRef.current
    const remaining = Math.max(0, timeoutMs - elapsed)
    const warningDelay = Math.max(0, remaining - warningMs)

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
    }, warningDelay)

    logoutTimerRef.current = setTimeout(() => {
      void signOutAndRedirect()
    }, remaining)
  }

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      const sessionActive = Boolean(data.session)
      setIsAuthenticated(sessionActive)
      lastActivityRef.current = Date.now()
    }

    void checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setIsAuthenticated(Boolean(session))
      if (session) {
        lastActivityRef.current = Date.now()
      } else {
        clearTimers()
        setShowWarning(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers()
      setShowWarning(false)
      return
    }

    scheduleTimers()

    const handleActivity = () => {
      if (!isAuthenticated) return
      if (pathname === '/login') return
      lastActivityRef.current = Date.now()
      setShowWarning(false)
      scheduleTimers()
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))

    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity))
    }
  }, [isAuthenticated, pathname, timeoutMs, warningMs])

  useEffect(() => {
    if (hasMountedRef.current && isAuthenticated) {
      scheduleTimers()
    }
    hasMountedRef.current = true
  }, [pathname, isAuthenticated, timeoutMs, warningMs])

  return (
    <>
      {children}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session expiring soon</DialogTitle>
            <DialogDescription>
              Your session will expire soon due to inactivity. Save your work or continue to stay signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>
              Keep me signed in
            </Button>
            <Button onClick={() => void signOutAndRedirect()}>
              Sign out now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
