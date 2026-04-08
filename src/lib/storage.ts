import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generate a signed URL for accessing private school assets
 * @param filePath - The path to the file in the school-assets bucket
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @param client - Optional Supabase client (defaults to browser client)
 * @returns Promise<string | null> - Signed URL or null if error/unauthorized
 */
export const getSchoolAssetSignedUrl = async (
  filePath: string, 
  expiresIn: number = 3600,
  client: SupabaseClient = supabase
): Promise<string | null> => {
  try {
    if (!filePath) return null

    const { data, error } = await client.storage
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
    // Type assertion needed until Supabase types are regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_school_asset_url', {
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
 * @param client - Optional Supabase client (defaults to browser client)
 * @returns Promise<string | null> - File path if successful, null if failed
 */
export const uploadSchoolAsset = async (
  file: File,
  schoolId: string,
  type: 'logo' | 'stamp' | 'signature',
  client: SupabaseClient = supabase
): Promise<string | null> => {
  try {
    // Enhanced file validation
    const validation = await validateImageFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid file');
    }

    // Create secure file path with timestamp to avoid conflicts
    const safeName = sanitizeFileName(file.name);
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = `${schoolId}/${type}s/${fileName}`;

    const { error } = await client.storage
      .from('school-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      })

    if (error) throw error

    return filePath
  } catch (error) {
    console.error(`Error uploading ${type}:`, error)
    return null
  }
}

/**
 * Enhanced file validation with magic number checks
 */
async function validateImageFile(file: File): Promise<{ isValid: boolean; error?: string }> {
  // File size check (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be less than 5MB' };
  }

  // Extension whitelist
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
    return { isValid: false, error: 'Only PNG, JPG, JPEG, GIF, and WebP files are allowed' };
  }

  // MIME type check
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!allowedMimeTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type' };
  }

  // Magic number validation
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const isValidImage = 
      // JPEG: FF D8 FF
      (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) ||
      // PNG: 89 50 4E 47
      (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) ||
      // GIF: 47 49 46 38
      (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) ||
      // WebP: RIFF...WEBP
      (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
       bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);

    if (!isValidImage) {
      return { isValid: false, error: 'File does not match expected image format' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Error reading file data' };
  }
}

/**
 * Sanitize filename to prevent directory traversal and other issues
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .substring(0, 100); // Limit length
}

/**
 * Delete a school asset file
 * @param filePath - The path to the file to delete
 * @param client - Optional Supabase client (defaults to browser client)
 * @returns Promise<boolean> - true if successful, false if failed
 */
export const deleteSchoolAsset = async (
  filePath: string,
  client: SupabaseClient = supabase
): Promise<boolean> => {
  try {
    const { error } = await client.storage
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
