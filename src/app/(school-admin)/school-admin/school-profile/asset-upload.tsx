'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { uploadSchoolAssetAction, deleteSchoolAssetAction } from './actions'
import { School } from '@/types'
import { Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface AssetUploadProps {
  school: School
  type: 'logo' | 'stamp' | 'signature'
  title: string
  description: string
}

export function AssetUpload({ school, type, title, description }: AssetUploadProps) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentUrl = type === 'logo' 
    ? school.logo_url 
    : type === 'stamp' 
    ? school.stamp_url 
    : school.head_signature_url

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const result = await uploadSchoolAssetAction(formData)

    if (result.success) {
      router.refresh()
    } else {
      setError(result.error || 'Failed to upload file')
    }

    setIsUploading(false)
    // Reset file input
    e.target.value = ''
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the ${title.toLowerCase()}?`)) {
      return
    }

    setIsDeleting(true)
    setError(null)

    const result = await deleteSchoolAssetAction(type)

    if (result.success) {
      router.refresh()
    } else {
      setError(result.error || 'Failed to delete file')
    }

    setIsDeleting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Image Preview */}
        {currentUrl ? (
          <div className="space-y-3">
            <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border">
              <Image
                src={currentUrl}
                alt={title}
                fill
                className="object-contain p-4"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting || isUploading}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
              <Label htmlFor={`${type}-upload`} className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isUploading || isDeleting}
                  onClick={() => document.getElementById(`${type}-upload`)?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Replace
                </Button>
              </Label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No {title.toLowerCase()} uploaded</p>
              </div>
            </div>
            <Label htmlFor={`${type}-upload`}>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isUploading || isDeleting}
                onClick={() => document.getElementById(`${type}-upload`)?.click()}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload {title}
              </Button>
            </Label>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          id={`${type}-upload`}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading || isDeleting}
        />

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* File Requirements */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Accepted formats: PNG, JPG, JPEG, GIF, WebP</p>
          <p>• Maximum file size: 5MB</p>
          <p>• Recommended size: 500x500 pixels</p>
        </div>
      </CardContent>
    </Card>
  )
}
