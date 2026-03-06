/**
 * Standalone Telegram message sender.
 *
 * Independent of the agent layer (dispatcher.ts) — this utility is used by
 * superadmin Server Actions and the onboarding wizard (Phase 16).
 *
 * No retry logic — the wizard handles retries. This is a simple fire-and-forget sender.
 */

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  botToken: string
): Promise<boolean> {
  if (!botToken) {
    console.error('[telegram/send] No bot token provided')
    return false
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    )

    if (!response.ok) {
      console.error(
        '[telegram/send] API error:',
        response.status,
        await response.text()
      )
    }

    return response.ok
  } catch (err) {
    console.error('[telegram/send] Network error:', err)
    return false
  }
}
