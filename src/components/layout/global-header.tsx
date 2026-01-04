import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getHeaderProps } from "@/lib/header-utils";

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
  // TODO: Implement real system health checks by:
  // 1. Call Supabase auth endpoint
  // 2. Query database connectivity
  // 3. Check API response from backend
  // For now, return neutral/healthy state
  return {
    auth: "healthy",
    database: "healthy",
    api: "healthy",
  };
}

function getFormattedTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
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
  if (!isAuthenticated) {
    return "/";
  }

  switch (userRole) {
    case "super_admin":
      return "/dashboard/super-admin";
    case "school_admin":
      return "/dashboard/school-admin";
    case "teacher":
      return "/dashboard/teacher";
    case "student":
      return "/dashboard/student";
    case "parent":
      return "/dashboard/parent";
    default:
      return "/";
  }
}

const getStatusIcon = (status: string) => {
  if (status === "healthy") return "✓";
  return "⚠";
};

export async function GlobalHeader() {
  const { isAuthenticated, userRole } = await getHeaderProps();
  const environment = getEnvironment();
  const environmentColor = getEnvironmentColor(environment);
  const systemStatus = await getSystemStatus();
  const contextIndicator = getContextIndicator(isAuthenticated, userRole);
  const dashboardLink = getDashboardLink(isAuthenticated, userRole);
  const timestamp = getFormattedTimestamp();

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

          {/* CENTER: Context Indicator + Last Refreshed (Hidden on mobile) */}
          <div className="hidden md:flex flex-1 flex justify-center items-center space-x-3">
            <Badge variant="outline" className={`${contextIndicator.style} border-0`}>
              {contextIndicator.label}
            </Badge>
            <span className="text-xs text-gray-500">Last refresh: {timestamp}</span>
          </div>

          {/* Mobile: Context badge only (shown on sm-md screens) */}
          <div className="hidden sm:flex md:hidden flex-1 flex justify-center">
            <Badge variant="outline" className={`${contextIndicator.style} border-0 text-xs`}>
              {contextIndicator.label}
            </Badge>
          </div>

          {/* RIGHT: System Status Cluster */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Environment Badge (Hidden on mobile) */}
            <Badge
              variant="outline"
              className={`hidden lg:inline-flex ${environmentColor} text-xs`}
              title={`Environment: ${environment}`}
            >
              {environment}
            </Badge>

            {/* Status Indicators */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Auth Status */}
              <div
                className="relative group"
                title="Authentication service status"
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                    systemStatus.auth === "healthy"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {getStatusIcon(systemStatus.auth)}
                </span>
                <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                  Auth: {systemStatus.auth}
                </div>
              </div>

              {/* Database Status */}
              <div
                className="relative group"
                title="Database service status"
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                    systemStatus.database === "healthy"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {getStatusIcon(systemStatus.database)}
                </span>
                <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                  DB: {systemStatus.database}
                </div>
              </div>

              {/* API Status */}
              <div
                className="relative group"
                title="API service status"
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                    systemStatus.api === "healthy"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {getStatusIcon(systemStatus.api)}
                </span>
                <div className="absolute hidden group-hover:block bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                  API: {systemStatus.api}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
