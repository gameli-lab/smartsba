import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function formatMonth(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET(request: NextRequest) {
  try {
    const requiredEnvVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars);
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL as string,
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY as string
    );

    const supabase = createClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL as string,
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'Unable to verify user permissions' }, { status: 500 });
    }

    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin privileges required' }, { status: 403 });
    }

    // Total schools count
    const { data: totalRows, error: totalError, count: totalCount } = await supabaseAdmin
      .from('schools')
      .select('id', { count: 'exact' });

    if (totalError) {
      console.error('Error fetching total schools:', totalError);
      return NextResponse.json({ error: 'Failed to fetch school counts' }, { status: 500 });
    }

    // Prepare 12-month window (including current month)
    const now = new Date();
    const months: string[] = [];
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = 11; i >= 0; i--) {
      const d = new Date(start);
      d.setUTCMonth(start.getUTCMonth() - i);
      months.push(formatMonth(d));
    }

    const fromDate = new Date(start);
    fromDate.setUTCMonth(start.getUTCMonth() - 11);

    // Fetch recent schools created within the window
    const { data: recent, error: recentError } = await supabaseAdmin
      .from('schools')
      .select('id, created_at')
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: true });

    if (recentError) {
      console.error('Error fetching recent schools:', recentError);
      return NextResponse.json({ error: 'Failed to fetch recent schools' }, { status: 500 });
    }

    // Aggregate counts per month
    const countsByMonth: Record<string, number> = {};
    months.forEach((m) => (countsByMonth[m] = 0));

    (recent || []).forEach((row: { id: string; created_at: string }) => {
      const created = new Date(row.created_at);
      const key = formatMonth(created);
      if (countsByMonth[key] !== undefined) countsByMonth[key]++;
    });

    const monthlyCounts = months.map((m) => ({ month: m, count: countsByMonth[m] || 0 }));

    return NextResponse.json({ totalSchools: totalCount ?? (totalRows || []).length, monthlyCounts }, { status: 200 });
  } catch (err) {
    console.error('Error in analytics schools count:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
