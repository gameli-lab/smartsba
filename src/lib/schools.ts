import { supabase } from './supabase'

export interface School {
  id: string
  name: string
  motto?: string
  address?: string
  phone?: string
  email?: string
}

export class SchoolService {
  // Get all schools (for sysadmin)
  static async getAllSchools(): Promise<School[]> {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, motto, address, phone, email')
      .order('name')

    if (error) throw error
    return data || []
  }

  // Get school by ID
  static async getSchoolById(schoolId: string): Promise<School | null> {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, motto, address, phone, email')
      .eq('id', schoolId)
      .single()

    if (error) return null
    return data
  }

  // Search schools by name (public endpoint for login)
  static async searchSchools(searchTerm: string): Promise<School[]> {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, motto, address')
      .ilike('name', `%${searchTerm}%`)
      .order('name')
      .limit(10)

    if (error) throw error
    return data || []
  }

  /**
   * Resolve a school input (ID or exact name) to a school ID without exposing the directory.
   * - If the input matches an existing school ID, return that ID.
   * - Otherwise, try an exact case-insensitive match on the school name.
   */
  static async resolveSchoolId(schoolInput: string): Promise<string | null> {
    const input = schoolInput.trim()
    if (!input) return null

    // First try direct ID match
    const { data: byId, error: idError } = await supabase
      .from('schools')
      .select('id')
      .eq('id', input)
      .single()

    if (byId && !idError) return byId.id

    // Then try exact case-insensitive name match
    const { data: byName, error: nameError } = await supabase
      .from('schools')
      .select('id')
      .ilike('name', input)
      .single()

    if (byName && !nameError) return byName.id

    return null
  }

  // Verify user belongs to school
  static async verifyUserSchoolAccess(userId: string, schoolId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('school_id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .single()

    return !error && data !== null
  }
}
