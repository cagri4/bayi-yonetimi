'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createDealer, updateDealer, type ActionState } from '@/lib/actions/dealers'
import Link from 'next/link'

interface DealerGroup {
  id: string
  name: string
  discount_percent: number
  min_order_amount: number
}

interface Dealer {
  id: string
  company_name: string
  email: string
  phone: string | null
  address: string | null
  dealer_group_id: string | null
  is_active: boolean
}

interface DealerFormProps {
  groups: DealerGroup[]
  dealer?: Dealer
}

const initialState: ActionState = {}

export function DealerForm({ groups, dealer }: DealerFormProps) {
  const isEdit = !!dealer

  const boundAction = isEdit
    ? updateDealer.bind(null, dealer.id)
    : createDealer

  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Bayi Duzenle' : 'Yeni Bayi'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.message && !state.success && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company_name">Firma Adi *</Label>
              <Input
                id="company_name"
                name="company_name"
                defaultValue={dealer?.company_name}
                required
              />
              {state.errors?.company_name && (
                <p className="text-sm text-red-500 mt-1">{state.errors.company_name[0]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={dealer?.email}
                required
              />
              {state.errors?.email && (
                <p className="text-sm text-red-500 mt-1">{state.errors.email[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={dealer?.phone || ''}
              />
            </div>

            <div>
              <Label htmlFor="dealer_group_id">Bayi Grubu</Label>
              <Select name="dealer_group_id" defaultValue={dealer?.dealer_group_id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Grup secin" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} (%{group.discount_percent} iskonto)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Adres</Label>
            <Textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={dealer?.address || ''}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              name="is_active"
              defaultChecked={dealer?.is_active ?? true}
              value="true"
            />
            <Label htmlFor="is_active">Aktif</Label>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={pending}>
              {pending ? 'Kaydediliyor...' : isEdit ? 'Guncelle' : 'Olustur'}
            </Button>
            <Link href="/admin/dealers">
              <Button type="button" variant="outline">
                Iptal
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
