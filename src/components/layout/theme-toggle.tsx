"use client"

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/providers/theme-provider'

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="h-8 px-2 text-xs"
      aria-label="Toggle light and dark mode"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </Button>
  )
}
