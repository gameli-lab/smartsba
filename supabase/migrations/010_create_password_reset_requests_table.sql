-- Create password_reset_requests table for moderated password resets.

CREATE TYPE public.password_reset_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

CREATE TABLE public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requesting_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- Applicable for school-bound users
    requested_at TIMESTAMPTZ DEFAULT now(),
    status public.password_reset_status DEFAULT 'pending' NOT NULL,
    approving_admin_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- The school admin who approves/rejects
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    reset_token TEXT, -- A token for internal tracking, not the Supabase reset token
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'), -- Request validity

    CONSTRAINT unique_pending_request_per_user UNIQUE (user_id, status) WHERE (status = 'pending')
);

COMMENT ON TABLE public.password_reset_requests IS 'Stores requests for user password resets that require admin approval.';
COMMENT ON COLUMN public.password_reset_requests.user_id IS 'The ID of the auth.users entry whose password is being requested to be reset.';
COMMENT ON COLUMN public.password_reset_requests.requesting_profile_id IS 'The user_profiles ID of the person making the reset request.';
COMMENT ON COLUMN public.password_reset_requests.school_id IS 'The school ID associated with the user for whom the reset is requested (if applicable).';
COMMENT ON COLUMN public.password_reset_requests.status IS 'The current status of the password reset request.';
COMMENT ON COLUMN public.password_reset_requests.approving_admin_id IS 'The user_profiles ID of the school admin who approved or rejected the request.';
COMMENT ON COLUMN public.password_reset_requests.reset_token IS 'An internal token for tracking the request, not the Supabase password reset token.';
COMMENT ON COLUMN public.password_reset_requests.expires_at IS 'Timestamp when the reset request (not the Supabase reset link) expires.';

-- Add RLS policies for password_reset_requests
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow school admin to view and update password reset requests for their school"
ON public.password_reset_requests FOR ALL
USING (
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()) = 'school_admin' AND
    (SELECT school_id FROM public.user_profiles WHERE user_id = auth.uid()) = school_id
)
WITH CHECK (
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()) = 'school_admin' AND
    (SELECT school_id FROM public.user_profiles WHERE user_id = auth.uid()) = school_id
);

CREATE POLICY "Allow users to request their own password reset"
ON public.password_reset_requests FOR INSERT
WITH CHECK (requesting_profile_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Allow users to view their own password reset requests"
ON public.password_reset_requests FOR SELECT
USING (requesting_profile_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Optional: Index on status for quicker lookup of pending requests
CREATE INDEX idx_password_reset_requests_status ON public.password_reset_requests (status);
