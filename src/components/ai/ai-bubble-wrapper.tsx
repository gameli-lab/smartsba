'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AIFloatingBubble } from '@/components/ai/ai-floating-bubble'

interface SchoolContext {
  schoolId: string
  schoolName?: string
}

export function AIBubbleWrapper({ schoolId }: { schoolId: string }) {
  const [context, setContext] = useState<SchoolContext | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchoolContext() {
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('id, name')
          .eq('id', schoolId)
          .single() as { data: { id: string; name: string } | null }

        if (school) {
          setContext({
            schoolId: school.id,
            schoolName: school.name,
          })
        }
      } catch (error) {
        console.error('Failed to load school context:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSchoolContext()
  }, [schoolId])

  if (loading || !context) {
    return null
  }

  return <AIFloatingBubble context={context} />
}
