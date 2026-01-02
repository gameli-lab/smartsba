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
  Menu,
  X,
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
import { useEffect, useRef } from "react";

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
      { icon: Home, label: "Dashboard", href: "/dashboard/school-admin" },
      {
        icon: Users,
        label: "Students",
        href: "/dashboard/school-admin/students",
      },
      {
        icon: UserCheck,
        label: "Teachers",
        href: "/dashboard/school-admin/teachers",
      },
      {
        icon: BookOpen,
        label: "Classes",
        href: "/dashboard/school-admin/classes",
      },
      {
        icon: GraduationCap,
        label: "Subjects",
        href: "/dashboard/school-admin/subjects",
      },
      {
        icon: Calendar,
        label: "Sessions",
        href: "/dashboard/school-admin/sessions",
      },
      {
        icon: FileText,
        label: "Reports",
        href: "/dashboard/school-admin/reports",
      },
      {
        icon: Bell,
        label: "Announcements",
        href: "/dashboard/school-admin/announcements",
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/dashboard/school-admin/settings",
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
  const pathname = usePathname();
  const config = roleConfig[userRole];
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <>
      {/* Hamburger Button */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpen}
          className="fixed left-4 top-4 z-50"
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 bg-white border-r border-gray-200 transition-all duration-300 transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold",
            config.color
          )}
        >
          {config.badge}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            Smart SBA
          </h1>
          {schoolName && (
            <p className="text-xs text-gray-500 truncate">{schoolName}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback className={cn("text-white text-sm", config.color)}>
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {userName}
            </p>
            <Badge variant="secondary" className="text-xs">
              {config.title}
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {config.items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              <span>Account</span>
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
    </>
  );
}
