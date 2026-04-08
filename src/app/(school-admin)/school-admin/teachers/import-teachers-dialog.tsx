'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload, Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { getTeachersTemplate, importTeachers } from './actions'

interface ImportFailure {
  row: number
  reason: string
}

interface ImportedCredential {
  row: number
  full_name: string
  email: string
  staff_id: string
  temp_password: string
}

export function ImportTeachersDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)
  const [failures, setFailures] = useState<ImportFailure[]>([])
  const [credentials, setCredentials] = useState<ImportedCredential[]>([])

  const resetState = () => {
    setFile(null)
    setError(null)
    setImported(null)
    setFailures([])
    setCredentials([])
  }

  const downloadCredentialsCsv = () => {
    if (!credentials.length) return

    const header = 'Row,Full Name,Email,Staff ID,Temporary Password\n'
    const rows = credentials
      .map((c) =>
        [c.row, c.full_name, c.email, c.staff_id, c.temp_password]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `teacher-import-credentials-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true)
      const result = await getTeachersTemplate()
      if (!result.success || !result.base64) {
        setError('Failed to generate template')
        return
      }

      const binary = atob(result.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename || 'teachers_template.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setError('Failed to download template')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setImported(null)
    setFailures([])

    if (!file) {
      setError('Please select an Excel file to import')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setIsImporting(true)
    const result = await importTeachers(formData)
    setIsImporting(false)

    if (!result.success || !result.result) {
      setError(result.error || 'Failed to import teachers')
      return
    }

    setImported(result.result.imported)
    setFailures(result.result.failed)
    setCredentials(result.result.credentials || [])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import Teachers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Teachers</DialogTitle>
          <DialogDescription>
            Download the Excel template, fill in teacher details, then upload to bulk create accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownloadTemplate}
              disabled={isDownloading || isImporting}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download Template
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-gray-700 space-y-2">
            <p className="font-medium">Required columns (Row 1 headers):</p>
            <p className="ml-1">• Full Name*, Email*, Staff ID*</p>
            <p className="ml-1">• Phone, Gender (Male/Female), Date of Birth (YYYY-MM-DD)</p>
            <p className="ml-1">• Address, Specialization, Qualification, Hire Date (YYYY-MM-DD)</p>
            <p className="text-xs text-gray-500 ml-1">* Required fields. Staff ID must be unique within your school.</p>
          </div>

          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Excel File (.xlsx)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500">Max size: 5MB. Only .xlsx files are supported.</p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isImporting}>
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import Teachers
              </Button>
            </div>
          </form>

          {imported !== null && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <CheckCircle className="h-5 w-5" />
                {imported} teacher{imported === 1 ? '' : 's'} imported successfully
              </div>

              {credentials.length > 0 && (
                <Alert variant="default" className="border-blue-200 bg-blue-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Temporary passwords generated</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-2 text-sm">
                      <p>Download and securely share login credentials with imported teachers.</p>
                      <Button type="button" size="sm" variant="outline" onClick={downloadCredentialsCsv}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Credentials CSV
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {failures.length > 0 ? (
                <Alert variant="default" className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Some rows failed</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 text-sm">
                      {failures.map((failure) => (
                        <div key={failure.row} className="flex items-start gap-2">
                          <span className="font-mono text-xs px-2 py-0.5 bg-white border rounded">Row {failure.row}</span>
                          <span>{failure.reason}</span>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="default" className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>All rows imported successfully</AlertTitle>
                </Alert>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
