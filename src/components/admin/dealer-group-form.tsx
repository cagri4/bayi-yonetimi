'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createDealerGroup, updateDealerGroup, type ActionState } from '@/lib/actions/dealers'

interface DealerGroup {
  id: string
  name: string
  discount_percent: number
  min_order_amount: number
  is_active: boolean
}

interface DealerGroupFormProps {
  group?: DealerGroup
  onSuccess?: () => void
}

const initialState: ActionState = {}

export function DealerGroupForm({ group, onSuccess }: DealerGroupFormProps) {
  const isEdit = !!group

  const boundAction = isEdit
    ? updateDealerGroup.bind(null, group.id)
    : createDealerGroup

  const [state, formAction, pending] = useActionState(async (prevState: ActionState, formData: FormData) => {
    const result = await boundAction(prevState, formData)
    if (result.success && onSuccess) {
      onSuccess()
    }
    return result
  }, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Grup Adi *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={group?.name}
          required
          placeholder="ornegin: Altin"
        />
        {state.errors?.name && (
          <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="discount_percent">Iskonto Orani (%) *</Label>
        <Input
          id="discount_percent"
          name="discount_percent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={group?.discount_percent || 0}
          required
        />
        {state.errors?.discount_percent && (
          <p className="text-sm text-red-500 mt-1">{state.errors.discount_percent[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="min_order_amount">Minimum Siparis Tutari (TL) *</Label>
        <Input
          id="min_order_amount"
          name="min_order_amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={group?.min_order_amount || 0}
          required
        />
        {state.errors?.min_order_amount && (
          <p className="text-sm text-red-500 mt-1">{state.errors.min_order_amount[0]}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          name="is_active"
          defaultChecked={group?.is_active ?? true}
          value="true"
        />
        <Label htmlFor="is_active">Aktif</Label>
      </div>

      {state.message && !state.success && (
        <p className="text-sm text-red-500">{state.message}</p>
      )}

      {state.success && (
        <p className="text-sm text-green-500">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Kaydediliyor...' : isEdit ? 'Guncelle' : 'Olustur'}
      </Button>
    </form>
  )
}
