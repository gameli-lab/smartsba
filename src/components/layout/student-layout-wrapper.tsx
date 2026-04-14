"use client"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function StudentLayoutWrapper({ children }: LayoutWrapperProps) {
  return <div className="overflow-x-clip pb-20 transition-all duration-300 md:pb-0 md:pl-20">{children}</div>
}
