"use client"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function ParentLayoutWrapper({ children }: LayoutWrapperProps) {
  return <div className="pb-20 transition-all duration-300 md:pb-0 md:pl-20">{children}</div>
}
