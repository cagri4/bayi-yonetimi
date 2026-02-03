// Supabase Edge Function for sending Expo Push Notifications
// Deploy with: supabase functions deploy push-notification
// Configure as Database Webhook on order_status_history table INSERT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// Status code to Turkish name mapping
const STATUS_NAMES: Record<string, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylandi',
  preparing: 'Hazirlaniyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  cancelled: 'Iptal Edildi',
}

// Notification body templates
const NOTIFICATION_BODIES: Record<string, string> = {
  confirmed: 'Siparisizin onaylandi ve hazirlaniyor.',
  preparing: 'Siparisizin hazirlanmaya baslandi.',
  shipped: 'Siparisizin kargoya verildi. Takip edebilirsiniz.',
  delivered: 'Siparisizin teslim edildi. Iyi gunlerde kullanin!',
  cancelled: 'Siparisizin iptal edildi.',
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    id: string
    order_id: string
    status_id: string
    notes: string | null
    created_at: string
  }
  schema: string
  old_record: null | Record<string, unknown>
}

interface ExpoPushMessage {
  to: string
  sound: 'default' | null
  title: string
  body: string
  data: Record<string, unknown>
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
}

Deno.serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse webhook payload
    const payload: WebhookPayload = await req.json()

    // Only process INSERT events on order_status_history
    if (payload.type !== 'INSERT' || payload.table !== 'order_status_history') {
      return new Response(JSON.stringify({ message: 'Ignored non-insert event' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { order_id, status_id } = payload.record

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get order details with status code
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        dealer_id,
        status:order_statuses!inner(code, name)
      `)
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.error('Error fetching order:', orderError)
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get dealer's push token
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('get_order_dealer_push_token', { p_order_id: order_id })

    if (tokenError) {
      console.error('Error fetching push token:', tokenError)
      return new Response(JSON.stringify({ error: 'Failed to get push token' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const pushToken = tokenData as string | null

    if (!pushToken) {
      console.log('No push token found for dealer')
      return new Response(JSON.stringify({ message: 'No push token, skipping notification' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Don't send notification for 'pending' status (initial order creation)
    const statusCode = (order.status as { code: string; name: string }).code
    if (statusCode === 'pending') {
      return new Response(JSON.stringify({ message: 'Skipping notification for pending status' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build notification message
    const statusName = STATUS_NAMES[statusCode] || statusCode
    const notificationBody = NOTIFICATION_BODIES[statusCode] || `Siparis durumunuz: ${statusName}`

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title: `Siparis ${order.order_number}`,
      body: notificationBody,
      data: {
        order_id: order.id,
        order_number: order.order_number,
        status: statusCode,
      },
      priority: 'high',
      channelId: 'orders',
    }

    // Send push notification via Expo API
    const expoPushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const expoPushResult = await expoPushResponse.json()

    if (!expoPushResponse.ok) {
      console.error('Expo push API error:', expoPushResult)
      return new Response(JSON.stringify({ error: 'Failed to send notification', details: expoPushResult }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Push notification sent:', expoPushResult)

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification sent',
      ticket: expoPushResult,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
