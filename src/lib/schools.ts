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
  // Get all schools (for super admin)
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
