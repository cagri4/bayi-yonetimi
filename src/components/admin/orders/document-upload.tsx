'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { uploadOrderDocument, deleteOrderDocument, type OrderDocument } from '@/lib/actions/order-docs'

interface DocumentUploadProps {
  orderId: string
  initialDocuments: OrderDocument[]
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  invoice: 'Fatura',
  irsaliye: 'Irsaliye',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DocumentUpload({ orderId, initialDocuments }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<OrderDocument[]>(initialDocuments)
  const [documentType, setDocumentType] = useState<'invoice' | 'irsaliye'>('invoice')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setError(null)
    setSuccess(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Lutfen bir dosya secin')
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('orderId', orderId)
    formData.append('documentType', documentType)
    formData.append('file', selectedFile)

    const result = await uploadOrderDocument(formData)

    if (!result.success) {
      setError(result.error || 'Yukleme basarisiz oldu')
      setIsUploading(false)
      return
    }

    // Optimistically add the new document to the list
    const newDoc: OrderDocument = {
      id: result.documentId!,
      orderId,
      documentType,
      fileName: selectedFile.name,
      filePath: `order-docs/${orderId}/${Date.now()}-${documentType}.pdf`,
      fileSize: selectedFile.size,
      uploadedAt: new Date().toISOString(),
    }
    setDocuments(prev => [newDoc, ...prev])
    setSelectedFile(null)
    setSuccess(`${DOCUMENT_TYPE_LABELS[documentType]} basariyla yuklendi`)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsUploading(false)
  }

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId)
    setError(null)

    const result = await deleteOrderDocument(documentId)

    if (!result.success) {
      setError(result.error || 'Silme basarisiz oldu')
    } else {
      setDocuments(prev => prev.filter(d => d.id !== documentId))
    }
    setDeletingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Belgeler
        </CardTitle>
        <CardDescription>
          Fatura ve irsaliye belgelerini yukleyin (PDF, maks. 5MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Form */}
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Belge Turu</Label>
              <Select
                value={documentType}
                onValueChange={(v) => setDocumentType(v as 'invoice' | 'irsaliye')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Fatura</SelectItem>
                  <SelectItem value="irsaliye">Irsaliye</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-file">PDF Dosyasi</Label>
              <input
                ref={fileInputRef}
                id="doc-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground
                  file:mr-3 file:py-1.5 file:px-3
                  file:rounded-md file:border file:border-input
                  file:text-sm file:font-medium file:bg-background
                  file:cursor-pointer cursor-pointer"
              />
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{selectedFile.name}</span>
              <span>({formatFileSize(selectedFile.size)})</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Yukleniyor...' : 'Yukle'}
          </Button>
        </div>

        {/* Existing Documents */}
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Henuz belge yuklenmemis.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-background"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {DOCUMENT_TYPE_LABELS[doc.documentType]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(doc.uploadedAt)}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
