"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, School, Users, TrendingUp, AlertCircle, CheckCircle2, AlertTriangle, Clock, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface KPIData {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  totalUsers: number;
  newSchoolsLastMonth: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    auth: 'healthy' | 'degraded' | 'down';
    api: 'healthy' | 'degraded' | 'down';
  };
}

interface AttentionItem {
  id: string;
  type: 'pending_activation' | 'recently_deactivated' | 'failed_operation' | 'admin_override';
  title: string;
  entity: string;
  timestamp?: string;
  severity: 'info' | 'warning' | 'critical';
}

interface ActivityLog {
  id: string;
  actor_name: string;
  actor_email: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name?: string | null;
  created_at: string;
}

interface TrendDataPoint {
  date: string;
  schools: number;
  users: number;
}

interface UserDistribution {
  role: string;
  count: number;
}

interface SchoolSnapshot {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  student_count: number;
  teacher_count: number;
}

interface SchoolAuditRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'inactive';
}

interface AuditLogRow {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

interface ProfileLookupRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface SchoolLookupRow {
  id: string;
  name: string;
}

interface CreatedAtRow {
  id: string;
  created_at: string;
}

interface RoleRow {
  role: string | null;
}

const KPISkeleton = () => (
  <div className="animate-pulse">
    <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
    <div className="h-4 bg-gray-100 rounded w-32"></div>
  </div>
);

const ActivitySkeleton = () => (
  <div className="animate-pulse space-y-3">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="h-12 bg-gray-100 rounded"></div>
    ))}
  </div>
);

const HealthBadge = ({ status }: { status: 'healthy' | 'degraded' | 'down' }) => {
  const config = {
    healthy: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
    degraded: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: AlertCircle },
    down: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
  };
  const { bg, text, icon: Icon } = config[status];
  return (
    <div className={`flex items-center gap-1 ${bg} ${text} px-2 py-1 rounded text-xs font-medium`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
};

const KPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  loading,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  href: string;
  loading?: boolean;
}) => (
  <Link href={href}>
    <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {loading ? (
              <KPISkeleton />
            ) : (
              <>
                <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              </>
            )}
          </div>
          <div className="flex-shrink-0 p-3 bg-gray-100 rounded-lg">
            <Icon className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  </Link>
);

const AttentionBadge = ({ type }: { type: string }) => {
  const config = {
    pending_activation: { label: 'Pending Activation', color: 'bg-blue-50 text-blue-700' },
    recently_deactivated: { label: 'Recently Deactivated', color: 'bg-yellow-50 text-yellow-700' },
    failed_operation: { label: 'Failed Operation', color: 'bg-red-50 text-red-700' },
    admin_override: { label: 'Admin Override', color: 'bg-purple-50 text-purple-700' },
  };
  const typeConfig = config[type as keyof typeof config];
  return (
    <Badge className={`text-xs font-medium ${typeConfig.color}`}>
      {typeConfig.label}
    </Badge>
  );
};

const formatActivityTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const formatActionLabel = (actionType: string) => {
  const labels: Record<string, string> = {
    school_created: 'Created School',
    school_updated: 'Updated School',
    school_deleted: 'Deleted School',
    school_activated: 'Activated School',
    school_deactivated: 'Deactivated School',
    user_role_changed: 'Changed User Role',
    bulk_import: 'Bulk Import',
    admin_override: 'Admin Override',
    bulk_activate: 'Bulk Activated',
    bulk_deactivate: 'Bulk Deactivated',
    bulk_delete: 'Bulk Deleted',
  };
  return labels[actionType] || actionType.replace(/_/g, ' ');
};

export default function SuperAdminDashboard() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [trendsData, setTrendsData] = useState<TrendDataPoint[]>([]);
  const [userDistribution, setUserDistribution] = useState<UserDistribution[]>([]);
  const [schoolsSnapshot, setSchoolsSnapshot] = useState<SchoolSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchKPIData = async () => {
    setIsRefreshing(true);
    try {
      // Fetch total schools
      const { count: totalSchools } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true });

      const { count: activeSchools } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: inactiveSchools } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'inactive');

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch new schools last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: newSchoolsLastMonth } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      // System health checks
      let authStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      let databaseStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      let apiStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) authStatus = 'degraded';
      } catch {
        authStatus = 'down';
      }

      try {
        const { error } = await supabase.from('schools').select('id', { count: 'exact', head: true });
        if (error) databaseStatus = 'degraded';
      } catch {
        databaseStatus = 'down';
      }

      // TODO: Add real API health check endpoint when available
      apiStatus = 'healthy';

      setKpiData({
        totalSchools: totalSchools || 0,
        activeSchools: activeSchools || 0,
        inactiveSchools: inactiveSchools || 0,
        totalUsers: totalUsers || 0,
        newSchoolsLastMonth: newSchoolsLastMonth || 0,
        systemHealth: {
          database: databaseStatus,
          auth: authStatus,
          api: apiStatus,
        },
      });

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchAttentionItems = async () => {
    try {
      const items: AttentionItem[] = [];
      
      // 1. Check for recently deactivated schools (last 24h)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { data: recentlyDeactivated } = await supabase
        .from('schools')
        .select('id, name, status, updated_at')
        .eq('status', 'inactive')
        .gte('updated_at', oneDayAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(5);

      if (recentlyDeactivated) {
        (recentlyDeactivated as SchoolAuditRow[]).forEach((school) => {
          items.push({
            id: `deactivated-${school.id}`,
            type: 'recently_deactivated',
            title: 'School Deactivated',
            entity: school.name,
            timestamp: school.updated_at,
            severity: 'warning',
          });
        });
      }

      // 2. Check for pending school activations (schools created but still inactive)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data: pendingActivations } = await supabase
        .from('schools')
        .select('id, name, created_at')
        .eq('status', 'inactive')
        .lt('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(5);

      if (pendingActivations) {
        (pendingActivations as SchoolAuditRow[]).forEach((school) => {
          items.push({
            id: `pending-${school.id}`,
            type: 'pending_activation',
            title: 'Pending Activation',
            entity: school.name,
            timestamp: school.created_at,
            severity: 'info',
          });
        });
      }

      // 3. Check for failed operations (from audit logs)
      const { data: failedOps } = await supabase
        .from('audit_logs')
        .select('id, entity_type, entity_id, created_at, metadata')
        .contains('metadata', { status: 'failed' })
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (failedOps) {
        (failedOps as AuditLogRow[]).forEach((log) => {
          items.push({
            id: `failed-${log.id}`,
            type: 'failed_operation',
            title: 'Failed Operation',
            entity: `${log.entity_type} operation`,
            timestamp: log.created_at,
            severity: 'critical',
          });
        });
      }

      // 4. Check for admin overrides (from audit logs)
      const { data: overrides } = await supabase
        .from('audit_logs')
        .select('id, entity_type, entity_id, created_at')
        .eq('action_type', 'admin_override')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (overrides) {
        (overrides as AuditLogRow[]).forEach((log) => {
          items.push({
            id: `override-${log.id}`,
            type: 'admin_override',
            title: 'Admin Override',
            entity: `${log.entity_type}`,
            timestamp: log.created_at,
            severity: 'warning',
          });
        });
      }

      // Sort by severity (critical > warning > info) and timestamp
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      items.sort((a, b) => {
        if (a.severity !== b.severity) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      });

      setAttentionItems(items.slice(0, 10)); // Limit to top 10 items
    } catch (error) {
      console.error('Error fetching attention items:', error);
    }
  };

  const fetchActivityLogs = async () => {
    setActivityLoading(true);
    try {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('id, actor_user_id, actor_role, action_type, entity_type, entity_id, created_at')
        .in('action_type', [
          'school_created',
          'school_deleted',
          'school_activated',
          'school_deactivated',
          'bulk_activate',
          'bulk_deactivate',
          'bulk_delete',
          'admin_override',
        ])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching activity logs:', error?.message || JSON.stringify(error));
        setActivityLogs([]);
      } else if (logs) {
        const logRows = logs as AuditLogRow[]
        // Fetch user profiles to get names and emails for each log entry
        const userIds = [...new Set(logRows.map((log) => log.actor_user_id))];
        const schoolIds = [
          ...new Set(
            logRows
              .filter((log) => log.entity_type === 'school' && !!log.entity_id)
              .map((log) => log.entity_id)
              .filter((id): id is string => !!id)
          ),
        ];
        
        let profileMap: Record<string, ProfileLookupRow> = {};
        let schoolMap: Record<string, SchoolLookupRow> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, first_name, last_name, email')
            .in('user_id', userIds);

          profileMap = ((profiles || []) as ProfileLookupRow[]).reduce<Record<string, ProfileLookupRow>>((acc, profile) => {
            acc[profile.user_id] = profile;
            return acc;
          }, {});
        }

        if (schoolIds.length > 0) {
          const { data: schools } = await supabase
            .from('schools')
            .select('id, name')
            .in('id', schoolIds);

          schoolMap = ((schools || []) as SchoolLookupRow[]).reduce<Record<string, SchoolLookupRow>>((acc, school) => {
            acc[school.id] = school;
            return acc;
          }, {});
        }

        const enrichedLogs = logRows.map((log) => {
          const profile = profileMap[log.actor_user_id];
          const school = log.entity_id ? schoolMap[log.entity_id] : undefined;
          return {
            ...log,
            actor_name: profile
              ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Unknown User'
              : 'Unknown User',
            actor_email: profile?.email || null,
            entity_name: school?.name || null,
          };
        });

        setActivityLogs(enrichedLogs);
      } else {
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Error in fetchActivityLogs:', error instanceof Error ? error.message : String(error));
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchTrendsData = async () => {
    setTrendsLoading(true);
    try {
      // Generate date range for last 30 days
      const dates: string[] = [];
      const schoolsByDate: { [key: string]: number } = {};
      const usersByDate: { [key: string]: number } = {};
      
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dates.push(dateStr);
        schoolsByDate[dateStr] = 0;
        usersByDate[dateStr] = 0;
      }

      // Fetch schools created in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: schools } = await supabase
        .from('schools')
        .select('id, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (schools) {
        (schools as CreatedAtRow[]).forEach((school) => {
          const dateStr = school.created_at.split('T')[0];
          if (schoolsByDate[dateStr] !== undefined) {
            schoolsByDate[dateStr]++;
          }
        });
      }

      // Fetch users created in last 30 days
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (users) {
        (users as CreatedAtRow[]).forEach((user) => {
          const dateStr = user.created_at.split('T')[0];
          if (usersByDate[dateStr] !== undefined) {
            usersByDate[dateStr]++;
          }
        });
      }

      // Aggregate data: cumulative counts
      const trends: TrendDataPoint[] = [];
      let cumulativeSchools = 0;
      let cumulativeUsers = 0;

      dates.forEach((date) => {
        cumulativeSchools += schoolsByDate[date];
        cumulativeUsers += usersByDate[date];
        trends.push({
          date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          schools: cumulativeSchools,
          users: cumulativeUsers,
        });
      });

      setTrendsData(trends);
    } catch (error) {
      console.error('Error fetching trends data:', error instanceof Error ? error.message : String(error));
      setTrendsData([]);
    } finally {
      setTrendsLoading(false);
    }
  };

  const fetchUserDistribution = async () => {
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('role');

      if (profiles) {
        const distribution: { [key: string]: number } = {
          super_admin: 0,
          school_admin: 0,
          teacher: 0,
          student: 0,
          parent: 0,
        };

        (profiles as RoleRow[]).forEach((profile) => {
          if (profile.role && distribution[profile.role] !== undefined) {
            distribution[profile.role]++;
          }
        });

        const distArray: UserDistribution[] = Object.entries(distribution)
          .map(([role, count]) => ({
            role: role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            count,
          }))
          .filter((d) => d.count > 0);

        setUserDistribution(distArray);
      }
    } catch (error) {
      console.error('Error fetching user distribution:', error instanceof Error ? error.message : String(error));
      setUserDistribution([]);
    }
  };

  const fetchSchoolsSnapshot = useCallback(async () => {
    setSchoolsLoading(true);
    try {
      let query = supabase
        .from('schools')
        .select('id, name, status, created_at, updated_at');

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      // Order by created_at descending
      query = query.order('created_at', { ascending: false });

      const { data: schools, error } = await query;

      if (error) {
        console.error('Error fetching schools snapshot:', error?.message || JSON.stringify(error));
        setSchoolsSnapshot([]);
        return;
      }

      if (!schools) {
        setSchoolsSnapshot([]);
        return;
      }

      // For each school, fetch student and teacher counts
      const enrichedSchools = await Promise.all(
        (schools as SchoolAuditRow[]).map(async (school) => {
          const { count: studentCount } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', school.id)
            .eq('role', 'student');

          const { count: teacherCount } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', school.id)
            .eq('role', 'teacher');

          return {
            id: school.id,
            name: school.name,
            status: school.status,
            created_at: school.created_at,
            updated_at: school.updated_at,
            student_count: studentCount || 0,
            teacher_count: teacherCount || 0,
          };
        })
      );

      setSchoolsSnapshot(enrichedSchools);
    } catch (error) {
      console.error('Error in fetchSchoolsSnapshot:', error instanceof Error ? error.message : String(error));
      setSchoolsSnapshot([]);
    } finally {
      setSchoolsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchKPIData();
    fetchAttentionItems();
    fetchActivityLogs();
    fetchTrendsData();
    fetchUserDistribution();
  }, []);

  // Refetch schools when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
    fetchSchoolsSnapshot();
  }, [searchQuery, statusFilter, fetchSchoolsSnapshot]);

  const getEnvironment = () => {
    // TODO: Add environment detection from env vars when available
    return 'Production';
  };

  const formatRefreshTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const formatSchoolDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Pagination helpers
  const filteredSchools = schoolsSnapshot;
  const totalPages = Math.ceil(filteredSchools.length / pageSize);
  const paginatedSchools = filteredSchools.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-8 text-gray-900 dark:text-gray-100">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl dark:text-gray-100">Super Admin Command Center</h1>
          <p className="mt-2 text-base text-gray-600 sm:text-lg dark:text-gray-300">Global Platform Oversight</p>
          <div className="flex items-center gap-3 mt-4">
            <Badge variant="outline" className="font-mono">
              {getEnvironment()}
            </Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400">Last refresh: {formatRefreshTime(lastRefresh)}</span>
          </div>
        </div>
        <Button
          onClick={() => {
            fetchKPIData();
            fetchAttentionItems();
            fetchActivityLogs();
            fetchTrendsData();
            fetchUserDistribution();
          }}
          disabled={isRefreshing}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards - Above the Fold */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Total Schools"
          value={kpiData?.totalSchools || 0}
          subtitle={`${kpiData?.activeSchools || 0} active, ${kpiData?.inactiveSchools || 0} inactive`}
          icon={School}
          href="/dashboard/super-admin/schools"
          loading={loading}
        />
        <KPICard
          title="Active Schools"
          value={kpiData?.activeSchools || 0}
          subtitle="Currently operational"
          icon={CheckCircle2}
          href="/dashboard/super-admin/schools"
          loading={loading}
        />
        <KPICard
          title="Inactive Schools"
          value={kpiData?.inactiveSchools || 0}
          subtitle="Paused or deactivated"
          icon={AlertCircle}
          href="/dashboard/super-admin/schools"
          loading={loading}
        />
        <KPICard
          title="Total Users"
          value={kpiData?.totalUsers || 0}
          subtitle="All roles across platform"
          icon={Users}
          href="/dashboard/super-admin/users"
          loading={loading}
        />
        <KPICard
          title="New Schools (30d)"
          value={kpiData?.newSchoolsLastMonth || 0}
          subtitle="Last 30 days"
          icon={TrendingUp}
          href="/dashboard/super-admin/schools"
          loading={loading}
        />
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Platform service status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Authentication</p>
              {loading ? (
                <KPISkeleton />
              ) : (
                <HealthBadge status={kpiData?.systemHealth.auth || 'healthy'} />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Database</p>
              {loading ? (
                <KPISkeleton />
              ) : (
                <HealthBadge status={kpiData?.systemHealth.database || 'healthy'} />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">API</p>
              {loading ? (
                <KPISkeleton />
              ) : (
                <HealthBadge status={kpiData?.systemHealth.api || 'healthy'} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Trends & Distribution - STAGE 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Trends Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <CardTitle>Growth Trends (30 Days)</CardTitle>
            </div>
            <CardDescription>Cumulative schools and users created</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
            ) : trendsData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-500">
                No trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendsData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="schools" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    name="Schools"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false}
                    name="Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* User Distribution Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <CardTitle>User Distribution</CardTitle>
            </div>
            <CardDescription>Users by role across platform</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
            ) : userDistribution.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-gray-500">
                No user data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userDistribution} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="role" 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attention Required Panel - STAGE 2 */}
      <Card className={attentionItems.length > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <CardTitle>Attention Required</CardTitle>
          </div>
          <CardDescription>Items requiring immediate action</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ActivitySkeleton />
          ) : attentionItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600">No issues detected</p>
              <p className="text-xs text-gray-500 mt-1">Platform is operating normally</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href="/dashboard/super-admin/schools"
                  className="block"
                >
                  <div className="flex items-start justify-between p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-600 mt-1 truncate">{item.entity}</p>
                      {item.timestamp && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatActivityTime(item.timestamp)}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <AttentionBadge type={item.type} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Feed - STAGE 2 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <CardDescription>Last 10 critical platform actions</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <ActivitySkeleton />
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-medium text-gray-900">
                        {formatActionLabel(log.action_type)}
                      </p>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {log.entity_type}
                      </Badge>
                      {log.entity_name && (
                        <span className="text-sm text-gray-700 truncate">
                          • {log.entity_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                      <span className="truncate">{log.actor_name || 'System'}</span>
                      {log.actor_email && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="truncate">{log.actor_email}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-4">
                    {formatActivityTime(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* School Status Snapshot - STAGE 4 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-blue-600" />
            <CardTitle>School Status Snapshot</CardTitle>
          </div>
          <CardDescription>Platform-wide school overview with search and filtering</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Search schools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600">
              {filteredSchools.length} school{filteredSchools.length !== 1 ? 's' : ''} found
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </div>

            {/* Table */}
            {schoolsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                ))}
              </div>
            ) : paginatedSchools.length === 0 ? (
              <div className="text-center py-12">
                <School className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No schools found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'No schools exist yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">School Name</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Students</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Teachers</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Created</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSchools.map((school) => (
                      <tr key={school.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-900 font-medium">{school.name}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={school.status === 'active' ? 'default' : 'secondary'}
                            className={
                              school.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {school.status.charAt(0).toUpperCase() + school.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{school.student_count}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{school.teacher_count}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{formatSchoolDate(school.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href="/dashboard/super-admin/schools"
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!schoolsLoading && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Access Navigation - STAGE 5 */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
          <CardDescription>Fast navigation to key platform management areas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Create New School */}
            <Link href="/dashboard/super-admin/schools">
              <Button variant="outline" className="w-full h-auto flex flex-col items-center gap-2 p-4 hover:bg-blue-50 hover:border-blue-500 transition-all group">
                <School className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">Create New School</span>
              </Button>
            </Link>

            {/* Manage Schools */}
            <Link href="/dashboard/super-admin/schools">
              <Button variant="outline" className="w-full h-auto flex flex-col items-center gap-2 p-4 hover:bg-purple-50 hover:border-purple-500 transition-all group">
                <School className="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">Manage Schools</span>
              </Button>
            </Link>

            {/* Manage Users */}
            <Link href="/dashboard/super-admin/users">
              <Button variant="outline" className="w-full h-auto flex flex-col items-center gap-2 p-4 hover:bg-green-50 hover:border-green-500 transition-all group">
                <Users className="w-6 h-6 text-green-600 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">Manage Users</span>
              </Button>
            </Link>

            {/* Analytics */}
            <Link href="/dashboard/super-admin/analytics">
              <Button variant="outline" className="w-full h-auto flex flex-col items-center gap-2 p-4 hover:bg-yellow-50 hover:border-yellow-500 transition-all group">
                <TrendingUp className="w-6 h-6 text-yellow-600 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">Analytics</span>
              </Button>
            </Link>

            {/* System Settings */}
            <Link href="/dashboard/super-admin/settings">
              <Button variant="outline" className="w-full h-auto flex flex-col items-center gap-2 p-4 hover:bg-gray-50 hover:border-gray-500 transition-all group">
                <AlertTriangle className="w-6 h-6 text-gray-600 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">System Settings</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
