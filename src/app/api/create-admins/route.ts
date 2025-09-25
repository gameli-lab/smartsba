import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Validate required environment variables
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
  console.error('Missing required environment variables:', missingVars.join(', '));
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
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

export async function POST(request: NextRequest) {
  try {
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

        // Check if user already exists by attempting to create and catching the error
        // This is more efficient than listing all users for large user bases
        let userExists = false;
        try {
          // Try to get the user profile first (this would exist if user was created)
          const { data: profileCheck } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id')
            .eq('email', admin.email)
            .single();
          
          if (profileCheck) {
            userExists = true;
          }
        } catch (profileError) {
          // Profile not found is expected for new users
          console.log('Profile check (expected for new users):', profileError);
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
                app_role: 'school_admin',
                school_id: schoolId,
              },
            }
          );

          if (claimsError) {
            console.error(`Error setting claims for ${admin.email}:`, claimsError);
            // Don't fail the whole operation for claims error, just log it
          }

          createdAdmins.push({
            name: admin.name,
            email: admin.email,
            password: tempPassword,
            role: admin.role || 'School Admin',
            staff_id: admin.staff_id,
            user_id: authData.user.id,
          });
        }
      } catch (adminError) {
        console.error(`Unexpected error creating admin ${admin.email}:`, adminError);
        errors.push(`Unexpected error for ${admin.email}: ${adminError}`);
      }
    }

    // Return response with results and any errors
    const response = {
      success: createdAdmins.length > 0,
      createdAdmins,
      totalRequested: admins.length,
      totalCreated: createdAdmins.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully created ${createdAdmins.length} out of ${admins.length} admin accounts`,
    };

    const statusCode = createdAdmins.length > 0 ? 200 : 400;
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
