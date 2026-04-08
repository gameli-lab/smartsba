import * as React from 'react'

type ButtonVariant = 'default' | 'outline'
type ButtonSize = 'default' | 'lg' | 'sm' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'outline' && 'border border-gray-300 bg-transparent text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800',
        size === 'default' && 'h-10 px-4 py-2',
        size === 'lg' && 'h-11 px-6 py-2.5 text-base',
        size === 'sm' && 'h-9 px-3',
        size === 'icon' && 'h-10 w-10',
        className
      )}
      {...props}
    />
  )
}
