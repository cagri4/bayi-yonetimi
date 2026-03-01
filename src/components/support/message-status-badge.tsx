import { Badge } from '@/components/ui/badge'

interface MessageStatusBadgeProps {
  status: 'pending' | 'answered'
}

export function MessageStatusBadge({ status }: MessageStatusBadgeProps) {
  if (status === 'answered') {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Cevaplandi
      </Badge>
    )
  }

  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
      Bekliyor
    </Badge>
  )
}
