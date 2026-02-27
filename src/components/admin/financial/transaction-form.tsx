'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createDealerTransaction } from '@/lib/actions/financials'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const transactionTypes = [
  { code: 'payment', name: 'Odeme', description: 'Bayi odeme yapti (alacak)' },
  { code: 'credit_note', name: 'Alacak Dekontu', description: 'Bakiye duzeltmesi (alacak)' },
  { code: 'debit_note', name: 'Borc Dekontu', description: 'Bakiye duzeltmesi (borc)' },
  { code: 'opening_balance', name: 'Acilis Bakiyesi', description: 'Hesap acilis bakiyesi' },
] as const

const formSchema = z.object({
  transactionTypeCode: z.enum(['payment', 'credit_note', 'debit_note', 'opening_balance']),
  amount: z.string().min(1, 'Tutar gerekli').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Gecerli bir tutar girin'
  ),
  description: z.string().min(1, 'Aciklama gerekli'),
  referenceNumber: z.string().optional(),
  transactionDate: z.string().min(1, 'Tarih gerekli'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface TransactionFormProps {
  dealerId: string
  onSuccess?: () => void
}

export function TransactionForm({ dealerId, onSuccess }: TransactionFormProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionTypeCode: 'payment',
      amount: '',
      description: '',
      referenceNumber: '',
      transactionDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  })

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      const result = await createDealerTransaction({
        dealerId,
        transactionTypeCode: data.transactionTypeCode,
        amount: parseFloat(data.amount),
        description: data.description,
        referenceNumber: data.referenceNumber || undefined,
        transactionDate: data.transactionDate,
        notes: data.notes || undefined,
      })

      if (result.success) {
        toast({
          title: 'Basarili',
          description: 'Islem kaydedildi',
        })
        form.reset()
        onSuccess?.()
      } else {
        toast({
          title: 'Hata',
          description: result.error || 'Islem kaydedilemedi',
          variant: 'destructive',
        })
      }
    })
  }

  const selectedType = transactionTypes.find(
    (t) => t.code === form.watch('transactionTypeCode')
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="transactionTypeCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Islem Tipi</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Islem tipi secin" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-muted-foreground">{selectedType.description}</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tutar (TL)</FormLabel>
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
                <Input placeholder="Islem aciklamasi" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="referenceNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Referans No (Opsiyonel)</FormLabel>
              <FormControl>
                <Input placeholder="Makbuz no, dekont no vb." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transactionDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Islem Tarihi</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          Islemi Kaydet
        </Button>
      </form>
    </Form>
  )
}
