'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { uploadProductImage } from '@/lib/actions/products'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

interface ImageUploadProps {
  productId: string
  currentImageUrl?: string | null
}

export function ImageUpload({ productId, currentImageUrl }: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(currentImageUrl || null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    const result = await uploadProductImage(productId, formData) as { success?: boolean; message?: string; imageUrl?: string }

    if (result.success && result.imageUrl) {
      setImageUrl(result.imageUrl)
      toast({ title: 'Resim yuklendi' })
    } else {
      toast({ title: result.message || 'Hata olustu', variant: 'destructive' })
    }

    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
        {imageUrl ? (
          <div className="relative w-full h-48">
            <Image
              src={imageUrl}
              alt="Urun resmi"
              fill
              className="object-contain rounded"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400">
            Resim yok
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Yukleniyor...' : imageUrl ? 'Resmi Degistir' : 'Resim Yukle'}
      </Button>
    </div>
  )
}
