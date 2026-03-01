'use client'

import { useState } from 'react'
import { FileText, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDocumentDownloadUrl, type OrderDocument } from '@/lib/actions/order-docs'

interface OrderDocumentsProps {
  documents: OrderDocument[]
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
  })
}

export function OrderDocuments({ documents }: OrderDocumentsProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async (doc: OrderDocument) => {
    setDownloadingId(doc.id)
    setError(null)

    const result = await getDocumentDownloadUrl(doc.id)

    if ('error' in result) {
      setError(result.error)
      setDownloadingId(null)
      return
    }

    // Open signed URL in new tab to trigger download
    const link = document.createElement('a')
    link.href = result.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.download = `${DOCUMENT_TYPE_LABELS[doc.documentType]}-${doc.uploadedAt.slice(0, 10)}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setDownloadingId(null)
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Belgeler
          </CardTitle>
          <CardDescription>Fatura ve irsaliye belgeleriniz</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Bu siparis icin henuz belge yuklenmemis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Belgeler
        </CardTitle>
        <CardDescription>
          {documents.length} belge mevcut — PDF olarak indirin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p className="text-sm text-destructive mb-2">{error}</p>
        )}
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(doc.uploadedAt)} · {formatFileSize(doc.fileSize)}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(doc)}
              disabled={downloadingId === doc.id}
              className="shrink-0 ml-3"
            >
              {downloadingId === doc.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloadingId === doc.id ? 'Hazirlaniyor...' : 'Indir'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
