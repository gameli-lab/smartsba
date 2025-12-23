import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    interface UserRow {
      id: string;
      user_id?: string;
      full_name?: string | null;
      role?: string | null;
      school_id?: string | null;
      auth_user?: { email?: string | null } | null;
      school?: { name?: string | null } | null;
    }
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

    // Support query params: page, per_page, q (search), role, school
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const perPage = Math.max(1, parseInt(url.searchParams.get('per_page') || '10', 10));
    const q = (url.searchParams.get('q') || '').trim();
    const roleFilter = url.searchParams.get('role') || 'all';
    const schoolFilter = url.searchParams.get('school') || 'all';

    let query = supabaseAdmin.from('user_profiles').select(
      `id, user_id, full_name, role, school_id, auth_user:auth.users(email), school:schools(name)`,
      { count: 'exact' },
    );

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,auth_user.email.ilike.%${q}%`);
    }

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }

    if (schoolFilter !== 'all') {
      const { data: schoolData } = await supabaseAdmin
        .from('schools')
        .select('id')
        .eq('name', schoolFilter)
        .single();
      const schoolRow = schoolData as { id: string } | null;
      if (schoolRow?.id) {
        query = query.eq('school_id', schoolRow.id);
      } else {
        return NextResponse.json({ users: [], total: 0 }, { status: 200 });
      }
    }

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;
    query = query.range(start, end);

    const { data, error, count } = await query.returns<UserRow[]>();
    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const users = (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      full_name: row.full_name,
      email: row.auth_user?.email || null,
      role: row.role,
      school: row.school?.name || null,
    }));

    return NextResponse.json({ users, total: count || 0 }, { status: 200 });
  } catch (err) {
    console.error('Error in super-admin GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
