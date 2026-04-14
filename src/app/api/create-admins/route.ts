import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import logAudit from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    // Validate required environment variables at runtime
    const requiredEnvVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    // Check for missing environment variables
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      // Log detailed information server-side for debugging
      console.error('Missing required environment variables:', missingVars);
      console.error('Server configuration incomplete. Check environment setup.');

      // Return generic error to client without exposing variable names
      return NextResponse.json(
        {
          error: 'Server configuration error',
          message: 'The server is not properly configured. Please contact the administrator.'
        },
        { status: 500 }
      );
    }

    // Create a Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL as string,
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY as string, // Service role key required
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create regular client for user verification
    const supabase = createClient(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL as string,
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Verify the user token using regular Supabase client
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if user has super_admin role using service role client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, school_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return NextResponse.json(
        { error: 'Unable to verify user permissions' },
        { status: 500 }
      );
    }

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Super admin privileges required' },
        { status: 403 }
      );
    }

    // Parse request body
    const { admins, schoolId } = await request.json();

    if (!admins || !Array.isArray(admins) || admins.length === 0) {
      return NextResponse.json(
        { error: 'Admin array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!schoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      );
    }

    const createdAdmins = [];
    const errors = [];

    for (const admin of admins) {
      try {
        // Validate admin data
        if (!admin.email || !admin.name) {
          errors.push(`Missing email or name for admin: ${admin.email || 'unknown'}`);
          continue;
        }

        // Check if user already exists using Auth Admin API and user_profiles
        let userExists = false;

        try {
          // Use Auth Admin API to check if user exists by email
          const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.listUsers();

          if (authUserError) {
            console.error(`Error listing auth users:`, authUserError);
            errors.push(`Error checking user existence for ${admin.email}: ${authUserError.message}`);
            continue;
          }

          // Check if email exists in auth users
          const authUser = authUserData?.users?.find(u => u.email === admin.email);
          if (authUser) {
            userExists = true;
          }
        } catch (authCheckError) {
          // Log unexpected errors during auth check
          console.error(`Error during auth user check for ${admin.email}:`, authCheckError);
          errors.push(`Failed to verify user existence for ${admin.email}`);
          continue;
        }

        // Also check user_profiles as fallback
        if (!userExists) {
          try {
            const { data: profileCheck, error: profileError } = await supabaseAdmin
              .from('user_profiles')
              .select('user_id')
              .eq('email', admin.email)
              .single();

            if (profileCheck && !profileError) {
              userExists = true;
            } else if (profileError && profileError.code !== 'PGRST116') {
              // PGRST116 is "not found" - expected for new users, so don't log
              // Log other unexpected profile errors
              console.error(`Unexpected profile error checking user ${admin.email}:`, profileError);
              errors.push(`Error checking user profile ${admin.email}: ${profileError.message}`);
              continue;
            }
          } catch (profileCheckError) {
            console.error(`Error during profile check for ${admin.email}:`, profileCheckError);
            errors.push(`Failed to verify user profile for ${admin.email}`);
            continue;
          }
        }

        if (userExists) {
          errors.push(`User with email ${admin.email} already exists`);
          continue;
        }

        // Generate cryptographically secure temporary password
        const generateSecurePassword = (length: number = 16): string => {
          const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!';
          const bytes = randomBytes(length);
          let password = '';

          for (let i = 0; i < length; i++) {
            password += charset[bytes[i] % charset.length];
          }

          // Ensure password contains at least one of each required type
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasDigit = /\d/.test(password);
          const hasSymbol = /[@#$%&*!]/.test(password);

          if (!hasUpper || !hasLower || !hasDigit || !hasSymbol) {
            // If missing required types, generate again (recursive)
            return generateSecurePassword(length);
          }

          return password;
        };

        const tempPassword = generateSecurePassword(16);

        // Create auth user using admin client
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: admin.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: admin.name,
            role: 'school_admin',
            school_id: schoolId,
            created_by: profile.full_name || user.email,
            created_at: new Date().toISOString(),
          },
        });

        if (authError) {
          console.error(`Error creating admin ${admin.email}:`, authError);
          errors.push(`Failed to create auth user for ${admin.email}: ${authError.message}`);
          continue;
        }

        if (authData.user) {
          // Create user profile
          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
              user_id: authData.user.id,
              school_id: schoolId,
              role: 'school_admin',
              email: admin.email,
              full_name: admin.name,
              staff_id: admin.staff_id || null,
              phone: admin.phone || null,
              status: 'active',
              created_at: new Date().toISOString(),
            });

          if (profileError) {
            console.error(`Error creating profile for ${admin.email}:`, profileError);
            errors.push(`Failed to create profile for ${admin.email}: ${profileError.message}`);

            // Clean up auth user if profile creation failed
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            continue;
          }

          // Add custom claims for the user
          const { error: claimsError } = await supabaseAdmin.auth.admin.updateUserById(
            authData.user.id,
            {
              app_metadata: {
                role: 'school_admin',
                school_id: schoolId,
              },
            }
          );

          if (claimsError) {
            console.error(`Error setting claims for ${admin.email}:`, claimsError);
            errors.push(`Warning: Failed to set app metadata for ${admin.email}. User may have limited permissions.`);
          }

          createdAdmins.push({
            name: admin.name,
            email: admin.email,
            password: tempPassword,
            role: admin.role || 'School Admin',
            staff_id: admin.staff_id,
            user_id: authData.user.id,
          });

          // Write audit log for admin creation (non-blocking)
          try {
            await logAudit(supabaseAdmin, user.id, 'create_admin', 'user_profile', authData.user.id, {
              email: admin.email,
              name: admin.name,
              schoolId,
            });
          } catch (e) {
            console.error('Failed to write audit entry for created admin:', e);
          }
        }
      } catch (adminError) {
        console.error(`Unexpected error creating admin ${admin.email}:`, adminError);
        errors.push(`Unexpected error for ${admin.email}: ${adminError}`);
      }
    }

    // Return response with results and any errors
    const statusCode = createdAdmins.length > 0 ? 200 : 400;
    const primaryError = errors.length > 0 ? errors[0] : undefined;

    const response = {
      success: createdAdmins.length > 0,
      createdAdmins,
      totalRequested: admins.length,
      totalCreated: createdAdmins.length,
      errors: errors.length > 0 ? errors : undefined,
      // Provide a top-level error string so the client can surface it
      error: statusCode !== 200 ? primaryError || "Failed to create admin accounts" : undefined,
      message: `Successfully created ${createdAdmins.length} out of ${admins.length} admin accounts`,
    };

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('Error in create-admins API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to create admin accounts' }, { status: 405 });
}
