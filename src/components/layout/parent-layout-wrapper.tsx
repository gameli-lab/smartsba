"use client"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function ParentLayoutWrapper({ children }: LayoutWrapperProps) {
  return <div className="transition-all duration-300 pl-0">{children}</div>
}
