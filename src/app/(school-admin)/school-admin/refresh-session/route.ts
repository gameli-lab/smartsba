import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'

/**
 * API route to refresh JWT claims for the current user
 * Call this endpoint to update JWT claims without logging out
 */
export async function POST() {
  try {
    const supabase = await createServerComponentClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Call the database function to set custom claims
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: claimsError } = await (supabase as any).rpc('set_custom_claims', {
      user_id: user.id
    })

    if (claimsError) {
      console.error('Error setting claims:', claimsError)
      return NextResponse.json(
        { error: 'Failed to refresh claims', details: claimsError.message },
        { status: 500 }
      )
    }

    // Sign out and sign back in to refresh the session with new claims
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.error('Error signing out:', signOutError)
    }

    return NextResponse.json({
      success: true,
      message: 'Claims refreshed. Please log in again to apply changes.'
    })
  } catch (error) {
    console.error('Error refreshing session:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
