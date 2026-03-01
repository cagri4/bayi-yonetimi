'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createFaqCategory,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
} from '@/lib/actions/support'
import { Plus, Pencil, Trash2, Check, X, FolderOpen } from 'lucide-react'
import type { FaqCategoryWithItems, FaqItem } from '@/types/database.types'

interface FaqItemRowProps {
  item: FaqItem
}

function FaqItemRow({ item }: FaqItemRowProps) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState(item.question)
  const [answer, setAnswer] = useState(item.answer)
  const router = useRouter()

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateFaqItem(item.id, { question, answer })
      if (result.success) {
        toast.success('Soru guncellendi')
        setEditing(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Guncellenemedi')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('Bu soruyu silmek istediginizden emin misiniz?')) return
    startTransition(async () => {
      const result = await deleteFaqItem(item.id)
      if (result.success) {
        toast.success('Soru silindi')
        router.refresh()
      } else {
        toast.error(result.error || 'Silinemedi')
      }
    })
  }

  if (editing) {
    return (
      <div className="border rounded-lg p-3 space-y-2 bg-blue-50">
        <div className="space-y-1">
          <Label className="text-xs">Soru</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cevap</Label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            disabled={isPending}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending || !question || !answer}>
            <Check className="h-3 w-3 mr-1" />
            Kaydet
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQuestion(item.question)
              setAnswer(item.answer)
              setEditing(false)
            }}
            disabled={isPending}
          >
            <X className="h-3 w-3 mr-1" />
            Iptal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-2 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.question}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.answer}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          disabled={isPending}
          className="h-7 w-7 p-0"
        >
          <Pencil className="h-3 w-3" />
          <span className="sr-only">Duzenle</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isPending}
          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">Sil</span>
        </Button>
      </div>
    </div>
  )
}

interface AddFaqItemFormProps {
  categoryId: string
}

function AddFaqItemForm({ categoryId }: AddFaqItemFormProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const router = useRouter()

  const handleAdd = () => {
    startTransition(async () => {
      const result = await createFaqItem(categoryId, question, answer)
      if (result.success) {
        toast.success('Soru eklendi')
        setQuestion('')
        setAnswer('')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Eklenemedi')
      }
    })
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" />
        Soru Ekle
      </Button>
    )
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-green-50">
      <div className="space-y-1">
        <Label className="text-xs">Soru</Label>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Soru metnini girin"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Cevap</Label>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Cevap metnini girin"
          rows={3}
          disabled={isPending}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={isPending || !question || !answer}>
          <Plus className="h-3 w-3 mr-1" />
          Ekle
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setQuestion('')
            setAnswer('')
            setOpen(false)
          }}
          disabled={isPending}
        >
          Iptal
        </Button>
      </div>
    </div>
  )
}

interface FaqManagerProps {
  categories: FaqCategoryWithItems[]
}

export function FaqManager({ categories }: FaqManagerProps) {
  const [isPending, startTransition] = useTransition()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const router = useRouter()

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    startTransition(async () => {
      const result = await createFaqCategory(newCategoryName)
      if (result.success) {
        toast.success('Kategori eklendi')
        setNewCategoryName('')
        setAddingCategory(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Eklenemedi')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Add category */}
      {addingCategory ? (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Kategori adi"
                disabled={isPending}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddCategory}
                disabled={isPending || !newCategoryName.trim()}
              >
                <Check className="h-4 w-4 mr-1" />
                Kaydet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewCategoryName('')
                  setAddingCategory(false)
                }}
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAddingCategory(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Kategori Ekle
        </Button>
      )}

      {/* Categories with items */}
      {categories.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Henuz kategori eklenmemis</p>
        </div>
      ) : (
        categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{category.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {category.faq_items.map((item) => (
                <FaqItemRow key={item.id} item={item} />
              ))}
              <AddFaqItemForm categoryId={category.id} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
