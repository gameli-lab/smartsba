import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, createServerComponentClient } from '@/lib/supabase'

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .substring(0, 100)
}

function buildAvatarPath(userId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName)
  const digest = createHash('sha1').update(`${userId}:${Date.now()}:${safeName}`).digest('hex').slice(0, 12)
  return `profile-avatars/${userId}/${digest}-${safeName}`
}

function isSupportedImage(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type)
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Avatar file is required' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Avatar must be smaller than 5MB' }, { status: 400 })
    }

    if (!isSupportedImage(file)) {
      return NextResponse.json({ error: 'Only PNG, JPG, JPEG, GIF, and WebP files are allowed' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('photo_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const avatarPath = buildAvatarPath(user.id, file.name)
    const oldAvatarPath = (profile as { photo_url?: string | null }).photo_url || null

    const { error: uploadError } = await admin.storage
      .from('school-assets')
      .upload(avatarPath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { error: updateError } = await admin
      .from('user_profiles')
      .update({ photo_url: avatarPath })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (oldAvatarPath && oldAvatarPath !== avatarPath) {
      await admin.storage.from('school-assets').remove([oldAvatarPath])
    }

    return NextResponse.json({ success: true, path: avatarPath })
  } catch (routeError) {
    console.error('Avatar upload failed:', routeError)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const path = url.searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    const supabase = await createServerComponentClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminSupabaseClient()
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('photo_url, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const typedProfile = profile as { photo_url?: string | null; role?: string }
    if (typedProfile.photo_url !== path) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: signedUrlData, error: signedUrlError } = await admin.storage
      .from('school-assets')
      .createSignedUrl(path, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: 'Unable to generate avatar URL' }, { status: 500 })
    }

    return NextResponse.redirect(signedUrlData.signedUrl)
  } catch (routeError) {
    console.error('Avatar fetch failed:', routeError)
    return NextResponse.json({ error: 'Failed to load avatar' }, { status: 500 })
  }
}
