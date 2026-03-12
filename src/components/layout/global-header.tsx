import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getHeaderProps } from "@/lib/header-utils";
import { GlobalUserMenu } from "./global-user-menu";

function getEnvironment(): string {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || "development";
  return env === "production"
    ? "Production"
    : env === "staging"
      ? "Staging"
      : "Local";
}

function getEnvironmentColor(env: string): string {
  switch (env) {
    case "Production":
      return "bg-red-50 text-red-700 border-red-300";
    case "Staging":
      return "bg-yellow-50 text-yellow-700 border-yellow-300";
    default:
      return "bg-blue-50 text-blue-700 border-blue-300";
  }
}

async function getSystemStatus() {
  return {
    auth: "healthy",
    database: "healthy",
    api: "healthy",
  };
}

function getContextIndicator(
  isAuthenticated: boolean,
  userRole?: string
): { label: string; style: string } {
  if (!isAuthenticated) {
    return { label: "PUBLIC ACCESS", style: "bg-gray-100 text-gray-700" };
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

const getStatusIcon = (status: string) =>
  status === "healthy" ? "✓" : "⚠";

export async function GlobalHeader() {
  const { isAuthenticated, userRole, userName, userEmail, contextInfo } =
    await getHeaderProps();
  const environment      = getEnvironment();
  const environmentColor = getEnvironmentColor(environment);
  const systemStatus     = await getSystemStatus();
  const contextIndicator = getContextIndicator(isAuthenticated, userRole);
  const dashboardLink    = getDashboardLink(isAuthenticated, userRole);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">

          {/* LEFT: Platform Branding */}
          <Link href={dashboardLink} className="flex items-center flex-shrink-0 group">
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                SmartSBA
              </span>
              <span className="hidden sm:inline text-xs text-gray-500">by Torvex Inc</span>
            </div>
          </Link>

          {/* CENTER: Context badge + school/session info (hidden on mobile) */}
          <div className="hidden md:flex flex-1 justify-center items-center space-x-3">
            <Badge variant="outline" className={`${contextIndicator.style} border-0`}>
              {contextIndicator.label}
            </Badge>
            {contextInfo && (
              <span className="text-xs text-gray-500 truncate max-w-xs">{contextInfo}</span>
            )}
          </div>

          {/* Mobile: context badge only (sm–md) */}
          <div className="hidden sm:flex md:hidden flex-1 justify-center">
            <Badge variant="outline" className={`${contextIndicator.style} border-0 text-xs`}>
              {contextIndicator.label}
            </Badge>
          </div>

          {/* RIGHT: Status indicators + User Menu */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">

            {/* Environment badge (desktop only) */}
            <Badge
              variant="outline"
              className={`hidden lg:inline-flex ${environmentColor} text-xs`}
              title={`Environment: ${environment}`}
            >
              {environment}
            </Badge>

            {/* Status dots */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {(["auth", "database", "api"] as const).map((svc) => (
                <div key={svc} className="relative group" title={`${svc} service status`}>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                      systemStatus[svc] === "healthy"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {getStatusIcon(systemStatus[svc])}
                  </span>
                  <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50 capitalize">
                    {svc}: {systemStatus[svc]}
                  </div>
                </div>
              ))}
            </div>

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
