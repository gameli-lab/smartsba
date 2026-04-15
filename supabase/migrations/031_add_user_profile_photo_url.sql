ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;
