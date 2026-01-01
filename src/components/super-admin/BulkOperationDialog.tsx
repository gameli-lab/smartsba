'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface BulkOperationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operation: 'activate' | 'deactivate' | 'delete'
  entityType: 'school' | 'user'
  selectedCount: number
  selectedItems: Array<{ id: string; name: string }>
  onConfirm: () => Promise<{ success: boolean; message: string; successCount: number; failureCount: number; failures?: Array<{ id: string; error: string }> }>
}

export function BulkOperationDialog({
  open,
  onOpenChange,
  operation,
  entityType,
  selectedCount,
  selectedItems,
  onConfirm,
}: BulkOperationDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    successCount: number
    failureCount: number
    failures?: Array<{ id: string; error: string }>
  } | null>(null)

  const operationText = {
    activate: 'Activate',
    deactivate: 'Deactivate',
    delete: 'Delete',
  }[operation]

  const isDestructive = operation === 'delete'

  const handleConfirm = async () => {
    setLoading(true)
    setResult(null)

    try {
      const res = await onConfirm()
      setResult(res)
    } catch (err) {
      setResult({
        success: false,
        message: 'Operation failed unexpectedly',
        successCount: 0,
        failureCount: selectedCount,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setResult(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDestructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {operationText} {selectedCount} {entityType}(s)
          </DialogTitle>
          <DialogDescription>
            {isDestructive
              ? `This action cannot be undone. This will permanently ${operation} the selected ${entityType}(s).`
              : `This will ${operation} the selected ${entityType}(s).`}
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Selected {entityType}s ({selectedCount}):</h4>
              <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-3">
                {selectedItems.map((item) => (
                  <div key={item.id} className="text-sm text-muted-foreground">
                    • {item.name}
                  </div>
                ))}
              </div>
            </div>

            {isDestructive && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: This action will permanently delete all selected {entityType}s and their associated data. This cannot be undone.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <Alert variant={result.success ? 'default' : 'destructive'} className={result.success ? 'border-green-200 bg-green-50' : ''}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription className={result.success ? 'text-green-900' : ''}>
                {result.message}
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">Successful</div>
                <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
              </div>
              {result.failureCount > 0 && (
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">Failed</div>
                  <div className="text-2xl font-bold text-destructive">{result.failureCount}</div>
                </div>
              )}
            </div>

            {result.failures && result.failures.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-sm">Failed Operations:</h4>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-3">
                  {result.failures.map((failure) => {
                    const item = selectedItems.find((i) => i.id === failure.id)
                    return (
                      <div key={failure.id} className="text-sm">
                        <Badge variant="destructive" className="mr-2">
                          Failed
                        </Badge>
                        <span className="font-medium">{item?.name || failure.id}</span>
                        <div className="text-xs text-muted-foreground ml-16">{failure.error}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant={isDestructive ? 'destructive' : 'default'}
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? `${operationText}ing...` : `Yes, ${operationText}`}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
