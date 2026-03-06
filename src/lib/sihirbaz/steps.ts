/**
 * Kurulum Sihirbazi — Step Handler Dispatcher
 *
 * Implements the FSM step transition logic for the wizard conversation.
 * Each case handles one state of the onboarding flow:
 *
 * Step 0:  /start received — send welcome + ask for firma adi → advance to 1
 * Step 1:  Receive firma_adi → ask sektor → advance to 2
 * Step 2:  Receive sektor → ask urun_sayisi → advance to 3
 * Step 3:  Receive urun_sayisi → ask bayi_sayisi → advance to 4
 * Step 4:  Receive bayi_sayisi → ask beklentiler → advance to 5
 * Step 5:  Receive beklentiler → send 12 agent intros + confirmation prompt → advance to 6
 * Step 6:  Receive evet/hayir — if yes: run provisioning; if no: expire session
 * Step 7+: Completed — send reminder message, no state change
 *
 * runProvisioning (private):
 * 1. Update company.settings with collected_data
 * 2. Generate a fresh temp password via auth.admin.updateUserById
 * 3. Send completion message with web panel URL and credentials
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from '@/lib/telegram/send'
import { AGENT_DESCRIPTIONS } from './agents'
import { updateSession, type WizardSession } from './session'

// ─── handleStep ───────────────────────────────────────────────────────────────

export async function handleStep(
  supabase: SupabaseClient,
  session: WizardSession,
  chatId: number,
  text: string,
  botToken: string
): Promise<void> {
  // Guard: completed sessions get a reminder and no state change
  if (session.status === 'completed') {
    await sendTelegramMessage(
      chatId,
      'Kurulum zaten tamamlandi. Web panelinize giris yapabilirsiniz.',
      botToken
    )
    return
  }

  switch (session.step) {
    // ── Step 0: Welcome — session just created from /start ──────────────────
    case 0: {
      await sendTelegramMessage(
        chatId,
        'Hosgeldiniz! Ben Kurulum Sihirbazinim. Firmanizi dijital donusume hazirlamak icin size yardimci olacagim.\n\nOnce birkac bilgiye ihtiyacim var.\n\nFirmanizin adi nedir?',
        botToken
      )
      await updateSession(supabase, session.id, { step: 1 })
      break
    }

    // ── Step 1: Receive firma_adi → ask sektor ───────────────────────────────
    case 1: {
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, firma_adi: text },
        step: 2,
      })
      await sendTelegramMessage(
        chatId,
        'Hangi sektorde faaliyet gosteriyorsunuz? (Ornek: Gida, Tekstil, Elektronik, Insaat)',
        botToken
      )
      break
    }

    // ── Step 2: Receive sektor → ask urun_sayisi ─────────────────────────────
    case 2: {
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, sektor: text },
        step: 3,
      })
      await sendTelegramMessage(
        chatId,
        'Yaklasik kac cesit urun satiyorsunuz?',
        botToken
      )
      break
    }

    // ── Step 3: Receive urun_sayisi → ask bayi_sayisi ────────────────────────
    case 3: {
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, urun_sayisi: text },
        step: 4,
      })
      await sendTelegramMessage(
        chatId,
        'Kac bayiniz var? (Yaklasik sayi)',
        botToken
      )
      break
    }

    // ── Step 4: Receive bayi_sayisi → ask beklentiler ────────────────────────
    case 4: {
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, bayi_sayisi: text },
        step: 5,
      })
      await sendTelegramMessage(
        chatId,
        'Dijital asistanlarinizdan en cok ne bekliyorsunuz? (Siparis takibi, stok yonetimi, muhasebe vb.)',
        botToken
      )
      break
    }

    // ── Step 5: Receive beklentiler → send 12 agent intros + confirmation ────
    case 5: {
      // Save beklentiler and advance to step 6
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, beklentiler: text },
        step: 6,
      })

      // Build agent introductions text
      const introLines = AGENT_DESCRIPTIONS.map(
        (agent, i) => `${i + 1}. ${agent.name}\n${agent.description}`
      )

      const header =
        'Harika! Simdi size 12 dijital calisaninizi tanistirmak istiyorum:\n\n'

      // Check Telegram 4096-char limit — split into two messages if needed
      const firstHalf = introLines.slice(0, 6).join('\n\n')
      const secondHalf = introLines.slice(6).join('\n\n')
      const fullText = header + introLines.join('\n\n')

      if (fullText.length > 3800) {
        // Send first 6 agents
        await sendTelegramMessage(
          chatId,
          header + firstHalf,
          botToken
        )
        // Send last 6 agents
        await sendTelegramMessage(chatId, secondHalf, botToken)
      } else {
        // Single message — fits within Telegram limit
        await sendTelegramMessage(chatId, fullText, botToken)
      }

      // Send confirmation prompt
      await sendTelegramMessage(
        chatId,
        'Tum bu dijital calisanlar 14 gun boyunca ucretsiz olarak hizmetinizde olacak.\n\nKurulumu baslatmak istiyor musunuz? (Evet / Hayir)',
        botToken
      )
      break
    }

    // ── Step 6: Receive confirmation (evet/hayir) ────────────────────────────
    case 6: {
      const normalized = text.toLowerCase().trim()
      const confirmed =
        normalized.includes('evet') ||
        normalized === 'e' ||
        normalized === '1'

      if (!confirmed) {
        await sendTelegramMessage(
          chatId,
          'Anlasildı. Kurulumu iptal ettiniz. Yeni bir davet linki icin yetkilinize basvurun.',
          botToken
        )
        await updateSession(supabase, session.id, { status: 'expired' })
        return
      }

      // User confirmed — run provisioning
      await runProvisioning(supabase, session, chatId, botToken)
      break
    }

    // ── Step 7+ / completed: post-completion guard ───────────────────────────
    default: {
      await sendTelegramMessage(
        chatId,
        'Kurulum zaten tamamlandi. Web panelinize giris yapabilirsiniz.',
        botToken
      )
      break
    }
  }
}

// ─── runProvisioning (private) ────────────────────────────────────────────────

/**
 * Completes the wizard flow after user confirms setup:
 * 1. Updates company.settings with collected onboarding data
 * 2. Generates a fresh temp password and resets the admin user's password
 * 3. Marks session as completed (step=7)
 * 4. Sends completion message with web panel URL and new credentials
 *
 * The fresh password approach (auth.admin.updateUserById) is intentional —
 * the original temp password generated by createCompany is ephemeral and
 * never stored. Resetting here gives the owner a clean credential flow.
 */
async function runProvisioning(
  supabase: SupabaseClient,
  session: WizardSession,
  chatId: number,
  botToken: string
): Promise<void> {
  // Guard: company_id must be set (always true if session was created from invite)
  if (!session.company_id) {
    console.error('[sihirbaz/steps] runProvisioning called with null company_id')
    await sendTelegramMessage(
      chatId,
      'Bir hata olustu: firma bilgisi bulunamadi. Lutfen yetkilinize basvurun.',
      botToken
    )
    return
  }

  // Step 1: Update company.settings with collected onboarding data
  const { collected_data } = session
  await (supabase as any)
    .from('companies')
    .update({
      settings: {
        sektor: collected_data.sektor,
        urun_sayisi: collected_data.urun_sayisi,
        bayi_sayisi: collected_data.bayi_sayisi,
        beklentiler: collected_data.beklentiler,
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    .eq('id', session.company_id)

  // Step 2: Generate a fresh temp password (12 chars from UUID — readable)
  const newTempPassword = crypto.randomUUID().slice(0, 12)

  // Step 3: Look up the company's admin user
  const { data: adminUser, error: userError } = await (supabase as any)
    .from('users')
    .select('id, email')
    .eq('company_id', session.company_id)
    .eq('role', 'admin')
    .single()

  if (userError || !adminUser) {
    console.error('[sihirbaz/steps] Admin user not found for company:', session.company_id, userError)
    await sendTelegramMessage(
      chatId,
      'Bir hata olustu: yonetici kullanici bulunamadi. Lutfen yetkilinize basvurun.',
      botToken
    )
    return
  }

  // Step 4: Reset admin password to fresh temp password
  const { error: pwError } = await supabase.auth.admin.updateUserById(
    adminUser.id,
    { password: newTempPassword }
  )

  if (pwError) {
    console.error('[sihirbaz/steps] Password reset failed:', pwError)
    // Non-fatal: continue and send completion message (password may still work)
  }

  // Step 5: Mark session as completed
  await updateSession(supabase, session.id, {
    status: 'completed',
    step: 7,
  })

  // Step 6: Send completion message with credentials
  const webPanelUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://bayi-yonetimi.vercel.app'

  await sendTelegramMessage(
    chatId,
    `Kurulum tamamlandi!\n\nWeb paneliniz: ${webPanelUrl}\n\nGiris bilgileriniz:\nE-posta: ${adminUser.email}\nGecici sifre: ${newTempPassword}\n\nIlk giriste sifrenizi degistirmenizi oneririz.\n\n14 gunluk ucretsiz deneme suresi baslamistir. Keyifli kullanımlar!`,
    botToken
  )
}
