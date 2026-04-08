"use client"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function TeacherLayoutWrapper({ children }: LayoutWrapperProps) {
  return <div className="transition-all duration-300 pl-0">{children}</div>
}
