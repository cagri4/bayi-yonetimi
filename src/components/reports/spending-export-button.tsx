'use client'

// NOTE: xlsx is NOT imported here — importing xlsx in a client component would
// add ~500KB to the client bundle. xlsx lives only in the route handler (route.ts).

import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SpendingExportButton() {
  const handleDownload = () => {
    // window.location.href triggers the browser's native download dialog.
    // Do NOT use fetch() here — it cannot trigger a file download dialog.
    window.location.href = '/api/reports/spending-export'
  }

  return (
    <Button variant="outline" onClick={handleDownload}>
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      Excel Indir
    </Button>
  )
}
