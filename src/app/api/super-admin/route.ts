import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    interface UserViewRow {
      id: string;
      user_id?: string | null;
      full_name?: string | null;
      role?: string | null;
      school_id?: string | null;
      school_name?: string | null;
      email?: string | null;
      status?: string | null;
      created_at?: string | null;
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

    // Support query params: cursor, per_page, q (search), role, school
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const perPage = Math.max(1, parseInt(url.searchParams.get('per_page') || '10', 10));
    const q = (url.searchParams.get('q') || '').trim();
    const roleFilter = url.searchParams.get('role') || 'all';
    const schoolFilter = url.searchParams.get('school') || 'all';

    // Select from view that includes email and school name to simplify queries
    let query = supabaseAdmin.from('vw_user_profiles_with_email').select(
      `id,user_id,email,full_name,role,school_id,school_name,status,created_at`,
    );

    if (q) {
      // Search by full_name or email available on the view
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
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
        return NextResponse.json({ users: [], next_cursor: null }, { status: 200 });
      }
    }

    // Apply cursor filters and ordering for stable pagination
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(perPage + 1);

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as { created_at: string; id: string };
        // Retrieve rows strictly older (lt) than the cursor (created_at,id) for descending order
        const cursorFilter = `or(created_at.lt.${decoded.created_at},(created_at.eq.${decoded.created_at},id.lt.${decoded.id}))`;
        query = query.or(cursorFilter);
      } catch {
        console.warn('Invalid cursor provided');
      }
    }

    const { data, error } = await query.returns<UserViewRow[]>();
    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const rows = data || [];
    // If we fetched one extra row, there is a next page
    let next_cursor: string | null = null;
    if (rows.length > perPage) {
      const last = rows[perPage - 1];
      const payload = { created_at: last.created_at, id: last.id };
      next_cursor = Buffer.from(JSON.stringify(payload)).toString('base64');
      // trim to requested page size
      rows.length = perPage;
    }

    const users = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id || null,
      full_name: row.full_name || null,
      email: row.email ?? null,
      role: row.role,
      school: row.school_name ?? null,
      status: row.status ?? null,
      created_at: row.created_at ?? null,
    }));

    return NextResponse.json({ users, next_cursor }, { status: 200 });
  } catch (err) {
    console.error('Error in super-admin GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
