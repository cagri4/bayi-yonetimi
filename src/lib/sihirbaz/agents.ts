/**
 * Kurulum Sihirbazi — 12 Dijital Calisanlar (Digital Employees) Descriptions
 *
 * Turkish names and descriptions for the 12 AI agents introduced to the
 * company owner during the wizard's step 5 → step 6 transition.
 *
 * Used by src/lib/sihirbaz/steps.ts in the agent introduction step.
 */

export type AgentDescription = {
  role: string
  name: string
  description: string
}

export const AGENT_DESCRIPTIONS: AgentDescription[] = [
  {
    role: 'egitimci',
    name: 'Egitimci',
    description:
      'Bayilerinize urun bilgisi ve satis teknikleri konusunda anlik egitim verir, sorularini seve seve yanitlar.',
  },
  {
    role: 'satis_temsilcisi',
    name: 'Satis Temsilcisi',
    description:
      'Bayi siparislerini 7/24 alir, urun onerilerinde bulunur ve aktif kampanyalari duyurur.',
  },
  {
    role: 'muhasebeci',
    name: 'Muhasebeci',
    description:
      'Bakiye sorgulama, fatura takibi ve borc durumu konularinda anlik bilgi verir.',
  },
  {
    role: 'depo_sorumlusu',
    name: 'Depo Sorumlusu',
    description:
      'Stok durumunu gercek zamanli olarak bildirir, dusuk stok uyarilarini iletir ve talepleri yonlendirir.',
  },
  {
    role: 'genel_mudur_danismani',
    name: 'Genel Mudur Danismani',
    description:
      'Firma yoneticilerine satis ozeti, bayi performansi ve stratejik oneriler sunar.',
  },
  {
    role: 'tahsilat_uzmani',
    name: 'Tahsilat Uzmani',
    description:
      'Vadesi gelen ve gecen odemeler icin bayileri bilgilendirir, tahsilat surecini adim adim takip eder.',
  },
  {
    role: 'dagitim_koordinatoru',
    name: 'Dagitim Koordinatoru',
    description:
      'Teslimat planlamasi, rota optimizasyonu ve dagitim durumu takibini yonetir.',
  },
  {
    role: 'saha_satis',
    name: 'Saha Satis Temsilcisi',
    description:
      'Saha ekibinin bayi ziyaret planlamasina, gorusme notlarinin kayit altina alinmasina destek olur.',
  },
  {
    role: 'pazarlamaci',
    name: 'Pazarlamaci',
    description:
      'Bayi segmentasyonu yapar, kampanya onerisi hazirlar ve promosyon bildirimlerini gonderir.',
  },
  {
    role: 'urun_yoneticisi',
    name: 'Urun Yoneticisi',
    description:
      'Urun katalogunu gunceller, fiyat listelerini duzenler ve yeni urun tanitimlarini yonetir.',
  },
  {
    role: 'satin_alma',
    name: 'Satin Alma Uzmani',
    description:
      'Tedarikci siparislerini koordine eder, optimal satin alma miktarlarini hesaplar ve stok ihtiyaclarini bildirir.',
  },
  {
    role: 'iade_kalite',
    name: 'Iade ve Kalite Sorumlusu',
    description:
      'Iade taleplerini alir, kalite sikayetlerini kayit altina alir ve cozum surecini bastan sona takip eder.',
  },
]
