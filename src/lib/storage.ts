import { supabase } from './supabase'

/**
 * Generate a signed URL for accessing private school assets
 * @param filePath - The path to the file in the school-assets bucket
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Promise<string | null> - Signed URL or null if error/unauthorized
 */
export const getSchoolAssetSignedUrl = async (
  filePath: string, 
  expiresIn: number = 3600
): Promise<string | null> => {
  try {
    if (!filePath) return null

    const { data, error } = await supabase.storage
      .from('school-assets')
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return null
  }
}

/**
 * Generate signed URLs for multiple files at once
 * @param filePaths - Array of file paths
 * @param expiresIn - Expiration time in seconds
 * @returns Promise<Record<string, string | null>> - Object mapping file paths to signed URLs
 */
export const getMultipleSchoolAssetUrls = async (
  filePaths: string[],
  expiresIn: number = 3600
): Promise<Record<string, string | null>> => {
  try {
    const results: Record<string, string | null> = {}
    
    const urlPromises = filePaths.map(async (filePath) => {
      const signedUrl = await getSchoolAssetSignedUrl(filePath, expiresIn)
      return { filePath, signedUrl }
    })

    const resolvedUrls = await Promise.all(urlPromises)
    
    resolvedUrls.forEach(({ filePath, signedUrl }) => {
      results[filePath] = signedUrl
    })

    return results
  } catch (error) {
    console.error('Error generating multiple signed URLs:', error)
    return {}
  }
}

/**
 * Check if a file path is accessible to the current user
 * Uses the database function to verify permissions
 * @param filePath - The file path to check
 * @returns Promise<boolean> - true if accessible, false otherwise
 */
export const canAccessSchoolAsset = async (filePath: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('get_school_asset_url', {
      file_path: filePath
    })

    if (error) {
      console.error('Error checking file access:', error)
      return false
    }

    return data !== null
  } catch (error) {
    console.error('Error verifying file access:', error)
    return false
  }
}

/**
 * Upload a file to school-assets bucket with proper folder structure
 * @param file - The file to upload
 * @param schoolId - The school ID for folder organization
 * @param type - The type of asset (logo, stamp, signature)
 * @returns Promise<string | null> - File path if successful, null if failed
 */
export const uploadSchoolAsset = async (
  file: File,
  schoolId: string,
  type: 'logo' | 'stamp' | 'signature'
): Promise<string | null> => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed')
    }

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 2MB')
    }

    // Create file path with timestamp to avoid conflicts
    const fileName = `${Date.now()}-${file.name}`
    const filePath = `${schoolId}/${type}s/${fileName}`

    const { data, error } = await supabase.storage
      .from('school-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    return filePath
  } catch (error) {
    console.error(`Error uploading ${type}:`, error)
    return null
  }
}

/**
 * Delete a school asset file
 * @param filePath - The path to the file to delete
 * @returns Promise<boolean> - true if successful, false if failed
 */
export const deleteSchoolAsset = async (filePath: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from('school-assets')
      .remove([filePath])

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
}

/**
 * Get file info without downloading
 * @param filePath - The path to the file
 * @returns Promise<{size: number, mimeType: string} | null>
 */
export const getSchoolAssetInfo = async (filePath: string) => {
  try {
    const { data, error } = await supabase.storage
      .from('school-assets')
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop()
      })

    if (error || !data || data.length === 0) return null

    const fileInfo = data[0]
    return {
      size: fileInfo.metadata?.size || 0,
      mimeType: fileInfo.metadata?.mimetype || 'unknown',
      lastModified: fileInfo.updated_at
    }
  } catch (error) {
    console.error('Error getting file info:', error)
    return null
  }
}
