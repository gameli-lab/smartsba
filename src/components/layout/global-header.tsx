import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getHeaderProps } from "@/lib/header-utils";
import { GlobalUserMenu } from "./global-user-menu";
import { ThemeToggle } from "./theme-toggle";

function getContextIndicator(
  isAuthenticated: boolean,
  userRole?: string
): { label: string; style: string } | null {
  if (!isAuthenticated) {
    return null;
  }
  switch (userRole) {
    case "super_admin":
      return { label: "GLOBAL ADMIN MODE", style: "bg-purple-100 text-purple-700" };
    case "school_admin":
      return { label: "SCHOOL ADMIN MODE", style: "bg-blue-100 text-blue-700" };
    case "teacher":
      return { label: "TEACHER DASHBOARD", style: "bg-green-100 text-green-700" };
    case "student":
      return { label: "STUDENT PORTAL", style: "bg-amber-100 text-amber-700" };
    case "parent":
      return { label: "PARENT PORTAL", style: "bg-pink-100 text-pink-700" };
    default:
      return { label: "AUTHENTICATED", style: "bg-gray-100 text-gray-700" };
  }
}

function getDashboardLink(isAuthenticated: boolean, userRole?: string): string {
  if (!isAuthenticated) return "/";
  switch (userRole) {
    case "super_admin": return "/dashboard/super-admin";
    case "school_admin": return "/school-admin";
    case "teacher":     return "/teacher";
    case "student":     return "/student";
    case "parent":      return "/parent";
    default:            return "/";
  }
}

export async function GlobalHeader() {
  const { isAuthenticated, userRole, userName, userEmail, contextInfo } =
    await getHeaderProps();
  const contextIndicator = getContextIndicator(isAuthenticated, userRole);
  const dashboardLink    = getDashboardLink(isAuthenticated, userRole);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">

          {/* LEFT: Platform Branding */}
          <Link href={dashboardLink} className="flex items-center flex-shrink-0 group">
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors dark:text-gray-100 dark:group-hover:text-blue-400">
                SmartSBA
              </span>
              <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">by Torvex Inc</span>
            </div>
          </Link>

          {/* CENTER: Context badge + school/session info (hidden on mobile) */}
          <div className="hidden md:flex flex-1 justify-center items-center space-x-3">
            {contextIndicator ? (
              <Badge variant="outline" className={`${contextIndicator.style} border-0`}>
                {contextIndicator.label}
              </Badge>
            ) : null}
            {contextInfo ? (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{contextInfo}</span>
            ) : null}
          </div>

          {/* Mobile: context badge only (sm–md) */}
          <div className="hidden sm:flex md:hidden flex-1 justify-center">
            {contextIndicator ? (
              <Badge variant="outline" className={`${contextIndicator.style} border-0 text-xs`}>
                {contextIndicator.label}
              </Badge>
            ) : null}
          </div>

          {/* RIGHT: Theme + User Menu */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <ThemeToggle />

            {/* User Menu (authenticated users only) */}
            {isAuthenticated && userName && userEmail && (
              <div className="border-l pl-2 sm:pl-4">
                <GlobalUserMenu
                  userName={userName}
                  userEmail={userEmail}
                  userRole={userRole}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
