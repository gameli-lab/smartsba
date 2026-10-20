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
