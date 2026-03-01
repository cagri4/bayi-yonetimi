'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { sendSupportMessage } from '@/lib/actions/support'
import { Send } from 'lucide-react'

const CATEGORIES = [
  { value: 'siparis', label: 'Siparis' },
  { value: 'urun', label: 'Urun' },
  { value: 'odeme', label: 'Odeme' },
  { value: 'teknik', label: 'Teknik' },
  { value: 'diger', label: 'Diger' },
] as const

export function MessageComposeForm() {
  const [isPending, startTransition] = useTransition()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<string>('')
  const [body, setBody] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!category) {
      toast.error('Lutfen bir kategori secin')
      return
    }

    if (body.length < 10) {
      toast.error('Mesaj en az 10 karakter olmalidir')
      return
    }

    startTransition(async () => {
      const result = await sendSupportMessage({
        subject,
        category: category as 'siparis' | 'urun' | 'odeme' | 'teknik' | 'diger',
        body,
      })

      if (result.success) {
        toast.success('Mesajiniz gonderildi')
        setSubject('')
        setCategory('')
        setBody('')
      } else {
        toast.error(result.error || 'Mesaj gonderilemedi')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Yeni Mesaj Gonder</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Konu</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Mesaj konusunu girin"
              required
              maxLength={200}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Select value={category} onValueChange={setCategory} disabled={isPending}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Kategori secin" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mesaj</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Mesajinizi buraya yazin (en az 10 karakter)"
              rows={5}
              minLength={10}
              maxLength={5000}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground text-right">{body.length}/5000</p>
          </div>

          <Button type="submit" disabled={isPending || !subject || !category || body.length < 10}>
            <Send className="h-4 w-4 mr-2" />
            {isPending ? 'Gonderiliyor...' : 'Gonder'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
