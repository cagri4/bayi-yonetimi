'use client'

import { useState, useTransition, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Upload, FileText, X } from 'lucide-react'
import { uploadInvoice } from '@/lib/actions/financials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'

const formSchema = z.object({
  invoiceNumber: z.string().min(1, 'Fatura numarasi gerekli'),
  invoiceDate: z.string().min(1, 'Fatura tarihi gerekli'),
  totalAmount: z.string().min(1, 'Tutar gerekli').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Gecerli bir tutar girin'
  ),
  description: z.string().min(1, 'Aciklama gerekli'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface InvoiceUploadProps {
  dealerId: string
  onSuccess?: () => void
}

export function InvoiceUpload({ dealerId, onSuccess }: InvoiceUploadProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      totalAmount: '',
      description: '',
      dueDate: '',
      notes: '',
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileError(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.type !== 'application/pdf') {
      setFileError('Sadece PDF dosyasi yukleyebilirsiniz')
      setSelectedFile(null)
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError('Dosya boyutu 10MB\'dan buyuk olamaz')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const clearFile = () => {
    setSelectedFile(null)
    setFileError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onSubmit = (data: FormData) => {
    if (!selectedFile) {
      setFileError('PDF dosyasi secmelisiniz')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('dealerId', dealerId)
      formData.append('invoiceNumber', data.invoiceNumber)
      formData.append('invoiceDate', data.invoiceDate)
      formData.append('totalAmount', data.totalAmount)
      formData.append('description', data.description)
      if (data.dueDate) formData.append('dueDate', data.dueDate)
      if (data.notes) formData.append('notes', data.notes)
      formData.append('file', selectedFile)

      const result = await uploadInvoice(formData)

      if (result.success) {
        toast({
          title: 'Basarili',
          description: 'Fatura yuklendi',
        })
        form.reset()
        clearFile()
        onSuccess?.()
      } else {
        toast({
          title: 'Hata',
          description: result.error || 'Fatura yuklenemedi',
          variant: 'destructive',
        })
      }
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="invoiceNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fatura Numarasi</FormLabel>
              <FormControl>
                <Input placeholder="FTR-2024-001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="invoiceDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fatura Tarihi</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vade Tarihi (Opsiyonel)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="totalAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fatura Tutari (TL)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aciklama</FormLabel>
              <FormControl>
                <Input placeholder="Fatura aciklamasi" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* File Upload */}
        <div className="space-y-2">
          <FormLabel>PDF Dosyasi</FormLabel>
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                PDF dosyasi secmek icin tiklayin
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Maksimum 10MB
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
              <FileText className="h-8 w-8 text-red-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notlar (Opsiyonel)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ek notlar..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Fatura Yukle
        </Button>
      </form>
    </Form>
  )
}
