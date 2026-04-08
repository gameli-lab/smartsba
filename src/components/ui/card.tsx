import * as React from 'react'

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('flex flex-col space-y-1.5 p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cx('font-semibold leading-none tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('text-sm text-gray-600 dark:text-gray-300', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('p-6 pt-0', className)} {...props} />
}
