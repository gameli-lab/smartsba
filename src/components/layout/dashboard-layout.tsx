"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { UserProfile } from "@/types";
import { AuthService } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({
  children,
  title,
  description,
}: DashboardLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ profile: UserProfile } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser) {
          router.push("/login");
          return;
        }
        setUser(currentUser);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="super-admin-scope min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        userRole={user.profile.role}
        userName={user.profile.full_name}
        schoolName="Demo School" // This would come from user.profile.school
      />

      <main className="flex flex-1 flex-col overflow-hidden pb-20 md:pb-0 md:pl-20">
        {/* Header */}
        {(title || description) && (
          <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="max-w-7xl mx-auto">
              {title && (
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</p>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-clip">
          <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
