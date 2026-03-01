'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { FaqCategoryWithItems } from '@/lib/actions/support'

interface FaqItemProps {
  question: string
  answer: string
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full text-left py-3 px-1 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors rounded"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="font-medium text-sm">{question}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="pb-3 px-1">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{answer}</p>
        </div>
      )}
    </div>
  )
}

interface FaqCategoryListProps {
  categories: FaqCategoryWithItems[]
}

export function FaqCategoryList({ categories }: FaqCategoryListProps) {
  // Filter to categories that have active items
  const activeCategories = categories.filter((cat) => cat.faq_items.length > 0)

  if (activeCategories.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">SSS henuz eklenmemistir</h3>
        <p className="text-sm text-muted-foreground">
          Sikca sorulan sorular yakin zamanda eklenecektir.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activeCategories.map((category) => (
        <Card key={category.id}>
          <CardContent className="p-4">
            <h3 className="font-semibold text-base mb-3">{category.name}</h3>
            <div className="divide-y">
              {category.faq_items.map((item) => (
                <FaqItem key={item.id} question={item.question} answer={item.answer} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
