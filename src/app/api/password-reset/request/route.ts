import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Placeholder for email sending functionality
async function sendApprovalEmail(adminEmail: string, approvalLink: string) {
  console.log(`Sending approval email to ${adminEmail} with link: ${approvalLink}`);
  // In a real application, you would integrate with an email service here (e.g., SendGrid, Resend, Nodemailer)
  // Example:
  /*
  await fetch('YOUR_EMAIL_SERVICE_ENDPOINT', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer YOUR_EMAIL_SERVICE_API_KEY`
    },
    body: JSON.stringify({
      to: adminEmail,
      subject: 'Password Reset Approval Required',
      html: `
        <p>A user has requested a password reset that requires your approval.</p>
        <p>Click <a href="${approvalLink}">here</a> to review and approve/reject the request.</p>
        <p>This link is valid for 1 hour.</p>
      `,
    }),
  });
  */
}

export async function POST(req: Request) {
  const supabaseAdmin = createAdminSupabaseClient();

  try {
    const { identifier, role, schoolId, wardAdmissionNumber } = await req.json();

    if (!identifier || !role) {
      return NextResponse.json({ error: 'Missing identifier or role' }, { status: 400 });
    }

    if (role === 'super_admin') {
      return NextResponse.json({ error: 'Super Admins cannot request password resets through this portal.' }, { status: 403 });
    }

    // 1. Find the user_profile based on identifier and role
    let userProfileQuery = supabaseAdmin
      .from('user_profiles')
      .select('id, user_id, email, school_id, full_name, role, admission_number, staff_id');

    if (role === 'parent') {
      if (!wardAdmissionNumber) {
        return NextResponse.json({ error: 'Ward Admission Number is required for parent password reset requests.' }, { status: 400 });
      }
      const normalizedIdentifier = String(identifier).trim().toLowerCase()
      // For parents, we need to join with parent_student_relationships and students
      const { data: parentRows, error: parentError } = await supabaseAdmin
        .from('user_profiles')
        .select(`
          id,
          user_id,
          email,
          school_id,
          full_name,
          role,
          parent_student_relationships!inner(
            student:students!inner(
              admission_number,
              school_id
            )
          )
        `)
        .eq('role', 'parent')
        .eq('parent_student_relationships.student.admission_number', wardAdmissionNumber)
        .eq('parent_student_relationships.student.school_id', schoolId) // Ensure ward is in the selected school
        .limit(20);

      if (parentError || !parentRows?.length) {
        console.error('Parent profile not found or ward mismatch:', parentError);
        return NextResponse.json({ error: 'Parent not found, ward admission number incorrect, or ward does not belong to the selected school.' }, { status: 404 });
      }
      const parentData = parentRows.find((row) => {
        const fullName = typeof row.full_name === 'string' ? row.full_name.trim().toLowerCase() : ''
        const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
        return fullName === normalizedIdentifier || email === normalizedIdentifier
      })

      if (!parentData) {
        return NextResponse.json({ error: 'Parent not found, ward admission number incorrect, or ward does not belong to the selected school.' }, { status: 404 });
      }

      // Reassign to userProfile for consistent processing
      // Note: The 'school_id' directly on parent_profile might be null, but we've verified through the ward's school_id
      const parentRow = parentData as unknown as {
        id: string;
        user_id: string;
        email?: string | null;
        full_name?: string | null;
        role?: string | null;
        parent_student_relationships: { student: { school_id: string } };
      };
      const userProfile = {
        id: parentRow.id,
        user_id: parentRow.user_id,
        email: parentRow.email,
        school_id: parentRow.parent_student_relationships.student.school_id, // Use ward's school_id
        full_name: parentRow.full_name,
        role: parentRow.role,
      };

      // Proceed with the determined userProfile
      // Ensure the found user's email is valid for sending a reset link later
      if (!userProfile.email) {
        return NextResponse.json({ error: 'User profile missing email address.' }, { status: 500 });
      }

      // 2. Find the School Admin for the user's school
      if (!userProfile.school_id) {
          return NextResponse.json({ error: 'User is not associated with a school.' }, { status: 400 });
      }

      const { data: schoolAdminProfile, error: adminProfileError } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('school_id', userProfile.school_id)
        .eq('role', 'school_admin')
        .single();

      if (adminProfileError || !schoolAdminProfile) {
          console.error('School admin not found:', adminProfileError);
          return NextResponse.json({ error: 'No school admin found for this school to approve the request.' }, { status: 404 });
      }

      // 3. Create a password_reset_request entry
      const resetToken = uuidv4(); // Internal token for tracking
      // Insert via Supabase REST to avoid client typings issues
      const restUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/password_reset_requests`;
      const restRes = await fetch(restUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_id: userProfile.user_id,
          requesting_profile_id: userProfile.id,
          school_id: userProfile.school_id,
          reset_token: resetToken,
        }),
      });

      if (!restRes.ok) {
        const errBody = await restRes.text().catch(() => '');
        console.error('REST insert error for password_reset_requests:', restRes.status, errBody);
        return NextResponse.json({ error: 'Failed to create password reset request.' }, { status: 500 });
      }

      const [resetRequest] = await restRes.json().catch(() => [null]);
      if (!resetRequest) {
        return NextResponse.json({ error: 'Failed to create password reset request.' }, { status: 500 });
      }

      // 4. Send email to the school admin for approval
      const approvalLink = `${process.env.NEXT_PUBLIC_BASE_URL}/admin/password-reset-approval/${resetRequest.id}`;
      const adminEmail = (schoolAdminProfile as { email?: string | null }).email;
      if (!adminEmail) {
        console.error('School admin profile missing email');
        return NextResponse.json({ error: 'No school admin email available' }, { status: 500 });
      }
      await sendApprovalEmail(adminEmail, approvalLink);

      return NextResponse.json({ message: 'Password reset request submitted for admin approval.' }, { status: 200 });

    } else if (role === 'student') {
      userProfileQuery = userProfileQuery.eq('admission_number', identifier);
    } else if (role === 'school_admin' || role === 'teacher') {
      userProfileQuery = userProfileQuery.eq('staff_id', identifier);
    } else {
        return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    if (schoolId) {
        userProfileQuery = userProfileQuery.eq('school_id', schoolId);
    }

    const { data: userProfile, error: profileError } = await userProfileQuery.single();

    if (profileError || !userProfile) {
        console.error('User profile not found:', profileError);
        return NextResponse.json({ error: 'User not found or credentials do not match.' }, { status: 404 });
    }

    // Ensure the found user's email is valid for sending a reset link later
    const foundEmail = (userProfile as { email?: string | null }).email;
    if (!foundEmail) {
      return NextResponse.json({ error: 'User profile missing email address.' }, { status: 500 });
    }

    // 2. Find the School Admin for the user's school
    const foundSchoolId = (userProfile as { school_id?: string | null }).school_id;
    if (!foundSchoolId) {
        return NextResponse.json({ error: 'User is not associated with a school.' }, { status: 400 });
    }

    const { data: schoolAdminProfile, error: adminProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('school_id', foundSchoolId)
      .eq('role', 'school_admin')
      .single();

    if (adminProfileError || !schoolAdminProfile) {
        console.error('School admin not found:', adminProfileError);
        return NextResponse.json({ error: 'No school admin found for this school to approve the request.' }, { status: 404 });
    }

    // 3. Create a password_reset_request entry via Supabase REST to avoid client typings
    const resetToken = uuidv4(); // Internal token for tracking
    const restUrl2 = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/password_reset_requests`;
    const restRes2 = await fetch(restUrl2, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: (userProfile as { user_id?: string }).user_id,
        requesting_profile_id: (userProfile as { id?: string }).id,
        school_id: (userProfile as { school_id?: string | null }).school_id,
        reset_token: resetToken,
      }),
    });

    if (!restRes2.ok) {
      const errBody = await restRes2.text().catch(() => '');
      console.error('REST insert error for password_reset_requests:', restRes2.status, errBody);
      return NextResponse.json({ error: 'Failed to create password reset request.' }, { status: 500 });
    }

    const [resetRequest] = await restRes2.json().catch(() => [null]);
    if (!resetRequest) {
      return NextResponse.json({ error: 'Failed to create password reset request.' }, { status: 500 });
    }

    // 4. Send email to the school admin for approval
    const approvalLink = `${process.env.NEXT_PUBLIC_BASE_URL}/admin/password-reset-approval/${resetRequest.id}`;
    const adminEmail2 = (schoolAdminProfile as { email?: string | null }).email;
    if (!adminEmail2) {
      console.error('School admin profile missing email');
      return NextResponse.json({ error: 'No school admin email available' }, { status: 500 });
    }
    await sendApprovalEmail(adminEmail2, approvalLink);

    return NextResponse.json({ message: 'Password reset request submitted for admin approval.' }, { status: 200 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
