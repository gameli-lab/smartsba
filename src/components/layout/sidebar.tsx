"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  Settings,
  LogOut,
  School,
  UserCheck,
  Calendar,
  BarChart3,
  Bell,
  Mail,
  TrendingUp,
} from "lucide-react";
import { UserRole } from "@/types";
import { AuthService } from "@/lib/auth";
import { useState } from "react";

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  schoolName?: string;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const roleConfig = {
  super_admin: {
    title: "Super Admin",
    color: "bg-purple-500",
    badge: "SUPER",
    items: [
      { icon: Home, label: "Dashboard", href: "/dashboard/super-admin" },
      {
        icon: School,
        label: "Schools",
        href: "/dashboard/super-admin/schools",
      },
      { icon: Users, label: "Users", href: "/dashboard/super-admin/users" },
      {
        icon: BarChart3,
        label: "Analytics",
        href: "/dashboard/super-admin/analytics",
      },
      {
        icon: TrendingUp,
        label: "Reports",
        href: "/dashboard/super-admin/reports",
      },
      {
        icon: FileText,
        label: "Audit Logs",
        href: "/dashboard/super-admin/audit-logs",
      },
      {
        icon: FileText,
        label: "AI Findings",
        href: "/dashboard/super-admin/security-findings",
      },
      {
        icon: Mail,
        label: "Email Logs",
        href: "/dashboard/super-admin/email-logs",
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/dashboard/super-admin/settings",
      },
    ],
  },
  school_admin: {
    title: "School Admin",
    color: "bg-blue-500",
    badge: "ADMIN",
    items: [
      { icon: Home, label: "Dashboard", href: "/school-admin" },
      {
        icon: Users,
        label: "Students",
        href: "/school-admin/students",
      },
      {
        icon: UserCheck,
        label: "Teachers",
        href: "/school-admin/teachers",
      },
      {
        icon: BookOpen,
        label: "Classes",
        href: "/school-admin/classes",
      },
      {
        icon: GraduationCap,
        label: "Subjects",
        href: "/school-admin/subjects",
      },
      {
        icon: Calendar,
        label: "Sessions",
        href: "/school-admin/academic-sessions",
      },
      {
        icon: FileText,
        label: "Reports",
        href: "/school-admin/reports",
      },
      {
        icon: Bell,
        label: "Announcements",
        href: "/school-admin/announcements",
      },
      {
        icon: FileText,
        label: "Security",
        href: "/school-admin/security",
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/school-admin/settings",
      },
    ],
  },
  teacher: {
    title: "Teacher",
    color: "bg-green-500",
    badge: "TCH",
    items: [
      { icon: Home, label: "Dashboard", href: "/dashboard/teacher" },
      {
        icon: Users,
        label: "My Classes",
        href: "/dashboard/teacher/classes",
      },
      {
        icon: BookOpen,
        label: "My Subjects",
        href: "/dashboard/teacher/subjects",
      },
      {
        icon: FileText,
        label: "Enter Scores",
        href: "/dashboard/teacher/scores",
      },
      {
        icon: UserCheck,
        label: "Attendance",
        href: "/dashboard/teacher/attendance",
      },
      { icon: FileText, label: "Reports", href: "/dashboard/teacher/reports" },
      {
        icon: Bell,
        label: "Announcements",
        href: "/dashboard/teacher/announcements",
      },
    ],
  },
  student: {
    title: "Student",
    color: "bg-indigo-500",
    badge: "STU",
    items: [
      { icon: Home, label: "Dashboard", href: "/dashboard/student" },
      {
        icon: FileText,
        label: "My Results",
        href: "/dashboard/student/results",
      },
      {
        icon: BarChart3,
        label: "Performance",
        href: "/dashboard/student/performance",
      },
      {
        icon: Bell,
        label: "Announcements",
        href: "/dashboard/student/announcements",
      },
    ],
  },
  parent: {
    title: "Parent",
    color: "bg-pink-500",
    badge: "PAR",
    items: [
      { icon: Home, label: "Dashboard", href: "/dashboard/parent" },
      { icon: Users, label: "My Wards", href: "/dashboard/parent/wards" },
      {
        icon: FileText,
        label: "Ward Results",
        href: "/dashboard/parent/results",
      },
      {
        icon: Bell,
        label: "Announcements",
        href: "/dashboard/parent/announcements",
      },
    ],
  },
};

export function Sidebar({
  userRole,
  userName,
  schoolName,
  isOpen = false,
  onOpen,
  onClose,
}: SidebarProps) {
  void schoolName;
  void isOpen;
  void onOpen;
  void onClose;
  const pathname = usePathname();
  const config = roleConfig[userRole];
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const primaryMobileItems = config.items.slice(0, 4);
  const overflowMobileItems = config.items.slice(4);

  return (
    <>
      <div
        className={cn(
          "group fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-20 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 hover:w-64 md:flex dark:border-gray-800 dark:bg-gray-950"
        )}
      >
        <div className="border-b border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-center justify-center gap-3 group-hover:justify-start">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" />
              <AvatarFallback className={cn("text-white text-sm", config.color)}>
                {userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 flex-1 group-hover:block">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
              <Badge variant="secondary" className="text-xs">
                {config.title}
              </Badge>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {config.items.map((item) => {
              const isActive = isActivePath(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors group-hover:justify-start",
                    isActive
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden group-hover:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-gray-200 p-2 dark:border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-center px-2 group-hover:justify-start dark:text-gray-100">
                <Settings className="h-4 w-4" />
                <span className="ml-2 hidden group-hover:inline">Account</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {primaryMobileItems.map((item) => {
            const isActive = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md px-1 py-2 text-[11px] font-medium",
                  isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            );
          })}
          <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto flex-col gap-1 rounded-md px-1 py-2 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                <Settings className="h-5 w-5" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mb-2 w-64">
              {overflowMobileItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild onClick={() => setIsMoreOpen(false)}>
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
