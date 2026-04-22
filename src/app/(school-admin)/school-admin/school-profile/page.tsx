import { requireSchoolAdmin } from '@/lib/auth-guards'
import { createServerComponentClient } from '@/lib/supabase'
import { getSchoolAssetSignedUrl } from '@/lib/storage'
import { School } from '@/types'
import { SchoolInfoForm } from './school-info-form'
import { AssetUpload } from './asset-upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import Image from 'next/image'

/**
 * School Profile Management Page
 * Allows school admins to update school information and assets
 */
export default async function SchoolProfilePage() {
  // Get authenticated school admin
  const { profile } = await requireSchoolAdmin()
  const schoolId = profile.school_id

  const supabase = await createServerComponentClient()

  // Fetch school data
  const { data: school, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single()

  if (error || !school) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Failed to load school profile</p>
        </div>
      </div>
    )
  }

  const typedSchool = school as School

  // Convert storage paths to signed URLs
  const logoUrl = typedSchool.logo_url 
    ? await getSchoolAssetSignedUrl(typedSchool.logo_url, 3600, supabase)
    : null
  const stampUrl = typedSchool.stamp_url
    ? await getSchoolAssetSignedUrl(typedSchool.stamp_url, 3600, supabase)
    : null
  const signatureUrl = typedSchool.head_signature_url
    ? await getSchoolAssetSignedUrl(typedSchool.head_signature_url, 3600, supabase)
    : null

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">School Profile</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Manage your school&apos;s information and assets
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Forms */}
        <div className="space-y-6">
          {/* School Information Form */}
          <SchoolInfoForm school={typedSchool} />

          {/* Asset Uploads */}
          <AssetUpload
            school={typedSchool}
            type="logo"
            title="School Logo"
            description="Upload your school's logo for use in reports and documents"
            currentAssetUrl={logoUrl}
          />

          <AssetUpload
            school={typedSchool}
            type="stamp"
            title="School Stamp"
            description="Upload your school's official stamp for reports"
            currentAssetUrl={stampUrl}
          />

          <AssetUpload
            school={typedSchool}
            type="signature"
            title="Headmaster Signature"
            description="Upload the headmaster's signature for reports"
            currentAssetUrl={signatureUrl}
          />
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Report Preview
              </CardTitle>
              <p className="text-sm text-gray-600">
                This is how your school information will appear on student reports
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-6 space-y-6">
                {/* Report Header Section */}
                <div className="text-center space-y-4 border-b dark:border-gray-700 pb-6">
                  {/* School Logo */}
                  {logoUrl ? (
                    <div className="relative w-24 h-24 mx-auto">
                      <Image
                        src={logoUrl}
                        alt="School Logo"
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 mx-auto bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400 dark:text-gray-500">No Logo</span>
                    </div>
                  )}

                  {/* School Name */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 uppercase">
                      {typedSchool.name}
                    </h2>
                    {typedSchool.motto && (
                      <p className="text-sm italic text-gray-600 dark:text-gray-300 mt-1">
                        &ldquo;{typedSchool.motto}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {typedSchool.address && (
                      <p className="font-medium">{typedSchool.address}</p>
                    )}
                    <div className="flex flex-wrap justify-center gap-3 text-xs">
                      {typedSchool.phone && <span>Tel: {typedSchool.phone}</span>}
                      {typedSchool.email && <span>Email: {typedSchool.email}</span>}
                    </div>
                    {typedSchool.website && (
                      <p className="text-xs text-blue-600">{typedSchool.website}</p>
                    )}
                  </div>
                </div>

                {/* Report Content Sample */}
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      STUDENT TERMINAL REPORT
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Academic Year 2024/2025 - Term 1</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded p-4 text-sm space-y-2">
                    <p className="text-gray-600 dark:text-gray-300">Student Name: <span className="font-medium text-gray-900 dark:text-gray-100">Sample Student</span></p>
                    <p className="text-gray-600 dark:text-gray-300">Class: <span className="font-medium text-gray-900 dark:text-gray-100">JHS 2A</span></p>
                    <p className="text-gray-600 dark:text-gray-300 text-xs italic">... (Report content)</p>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="border-t dark:border-gray-700 pt-4 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="h-16 flex items-end justify-center mb-2">
                      {signatureUrl ? (
                        <div className="relative w-32 h-12">
                          <Image
                            src={signatureUrl}
                            alt="Signature"
                            fill
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">
                          (Signature)
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-400 pt-1">
                      <p className="text-xs font-medium">Headmaster&apos;s Signature</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="h-16 flex items-center justify-center mb-2">
                      {stampUrl ? (
                        <div className="relative w-16 h-16">
                          <Image
                            src={stampUrl}
                            alt="Stamp"
                            fill
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-xs text-gray-400">Stamp</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-400 pt-1">
                      <p className="text-xs font-medium">School Stamp</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Note */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> This is a preview of how your school information 
                  will appear on generated student reports. Changes made above will be 
                  reflected here immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
