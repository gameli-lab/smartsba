import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logAudit from '@/lib/audit';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  // Some Next types provide params as a Promise in the route context; normalize it here
  const resolvedParams = await Promise.resolve(params) as { id: string };
  const id = resolvedParams.id;
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
      return NextResponse.json({ error: 'SysAdmin privileges required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      status?: string;
      full_name?: string;
      email?: string;
    };

    const updates: Record<string, unknown> = {};

    if (body.status) updates.status = body.status;
    if (body.full_name) updates.full_name = body.full_name;
    if (body.email) updates.email = body.email;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating sysadmin profile:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Log audit record
    try {
      await logAudit(supabaseAdmin, user.id, 'update_super_admin', 'user_profile', id, updates);
    } catch (e) {
      console.error('Audit logging failed:', e);
    }

    return NextResponse.json({ success: true, updates }, { status: 200 });
  } catch (err) {
    console.error('Error in super-admin PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  const resolvedParams = await Promise.resolve(params) as { id: string };
  const id = resolvedParams.id;
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
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
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
      return NextResponse.json({ error: 'SysAdmin privileges required' }, { status: 403 });
    }

    // Fetch the target profile to find the auth user id
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('id', id)
      .single();

    if (targetError || !targetProfile) {
      console.error('Target profile fetch error:', targetError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const targetUserId = (targetProfile as { user_id?: string }).user_id;
    if (!targetUserId) {
      console.error('No user_id on target profile');
      return NextResponse.json({ error: 'Invalid user profile' }, { status: 400 });
    }

    // Delete the profile row first
    const { error: deleteProfileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
      return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
    }

    // Delete the auth user
    try {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError);
        // Not returning here; profile already deleted. Inform client.
        return NextResponse.json({ success: false, message: 'Profile deleted but failed to remove auth user' }, { status: 500 });
      }
    } catch (e) {
      console.error('Unexpected error deleting auth user:', e);
      return NextResponse.json({ success: false, message: 'Profile deleted but auth removal failed' }, { status: 500 });
    }

    // Log audit record
    try {
      await logAudit(supabaseAdmin, user.id, 'delete_super_admin', 'user_profile', id, { user_id: targetUserId });
    } catch (e) {
      console.error('Audit logging failed:', e);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Error in super-admin DELETE:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
