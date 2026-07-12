import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  COMMISSION_PERCENT_EXAMPLE,
  EMERGENCY_FALLBACK_SECONDS,
  EMERGENCY_NUMBERS,
  JITSI_BASE_URL,
} from './config'
import { supabase } from './supabaseClient'
import type { Json } from './database.types'

// ============================================================
// Paramètres système — lus depuis la table sante_settings
// (modifiables par l'admin via /admin/parametres), avec repli
// sur les valeurs par défaut de config.ts si la table est vide
// ou si la migration 010 n'a pas encore été exécutée.
// ============================================================

export interface MobileMoneySettings {
  wave_enabled: boolean
  wave_merchant_id: string
  wave_payment_link: string
  om_enabled: boolean
  om_merchant_id: string
  om_payment_link: string
  mtn_enabled: boolean
  mtn_merchant_id: string
  mtn_payment_link: string
}

export interface AppSettings {
  emergencyNumbers: { samu: string; pompiers: string; police: string }
  emergencyFallbackSeconds: number
  jitsiBaseUrl: string
  commissionPercent: number
  legalMentions: string
  legalConfidentialite: string
  legalCgu: string
  mobileMoney: MobileMoneySettings
}

export const DEFAULT_MOBILE_MONEY: MobileMoneySettings = {
  wave_enabled: false,
  wave_merchant_id: '',
  wave_payment_link: '',
  om_enabled: false,
  om_merchant_id: '',
  om_payment_link: '',
  mtn_enabled: false,
  mtn_merchant_id: '',
  mtn_payment_link: '',
}

const DEFAULTS: AppSettings = {
  emergencyNumbers: { ...EMERGENCY_NUMBERS },
  emergencyFallbackSeconds: EMERGENCY_FALLBACK_SECONDS,
  jitsiBaseUrl: JITSI_BASE_URL,
  commissionPercent: COMMISSION_PERCENT_EXAMPLE,
  legalMentions: '',
  legalConfidentialite: '',
  legalCgu: '',
  mobileMoney: { ...DEFAULT_MOBILE_MONEY },
}

interface SettingsContextValue {
  settings: AppSettings
  /** true tant que le premier chargement n'est pas terminé */
  loading: boolean
  /** true si les valeurs proviennent du code (table absente/vide) */
  usingDefaults: boolean
  refresh: () => Promise<void>
  /** Enregistre plusieurs clés d'un coup (admin uniquement, RLS). */
  saveSettings: (values: Record<string, Json>) => Promise<string | null>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function asString(v: Json | undefined, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function asNumber(v: Json | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function parse(rows: { key: string; value: Json }[]): AppSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const emergency = (map.get('emergency_numbers') ?? {}) as Record<string, Json>
  const mm = (map.get('mobile_money') ?? {}) as Record<string, Json>
  return {
    emergencyNumbers: {
      samu: asString(emergency['samu'], DEFAULTS.emergencyNumbers.samu),
      pompiers: asString(emergency['pompiers'], DEFAULTS.emergencyNumbers.pompiers),
      police: asString(emergency['police'], DEFAULTS.emergencyNumbers.police),
    },
    emergencyFallbackSeconds: asNumber(
      map.get('emergency_fallback_seconds'),
      DEFAULTS.emergencyFallbackSeconds,
    ),
    jitsiBaseUrl: asString(map.get('jitsi_base_url'), DEFAULTS.jitsiBaseUrl).replace(/\/$/, ''),
    commissionPercent: asNumber(map.get('commission_percent'), DEFAULTS.commissionPercent),
    legalMentions: asString(map.get('legal_mentions'), ''),
    legalConfidentialite: asString(map.get('legal_confidentialite'), ''),
    legalCgu: asString(map.get('legal_cgu'), ''),
    mobileMoney: {
      wave_enabled: mm['wave_enabled'] === true,
      wave_merchant_id: asString(mm['wave_merchant_id'], ''),
      wave_payment_link: asString(mm['wave_payment_link'], ''),
      om_enabled: mm['om_enabled'] === true,
      om_merchant_id: asString(mm['om_merchant_id'], ''),
      om_payment_link: asString(mm['om_payment_link'], ''),
      mtn_enabled: mm['mtn_enabled'] === true,
      mtn_merchant_id: asString(mm['mtn_merchant_id'], ''),
      mtn_payment_link: asString(mm['mtn_payment_link'], ''),
    },
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [usingDefaults, setUsingDefaults] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('sante_settings').select('key, value')
    if (error || !data || data.length === 0) {
      // Migration 010 non exécutée ou table vide → valeurs du code
      setSettings(DEFAULTS)
      setUsingDefaults(true)
    } else {
      setSettings(parse(data))
      setUsingDefaults(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveSettings = useCallback(
    async (values: Record<string, Json>): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser()
      const rows = Object.entries(values).map(([key, value]) => ({
        key,
        value,
        updated_by: userData.user?.id ?? null,
      }))
      const { error } = await supabase.from('sante_settings').upsert(rows)
      if (error) return error.message
      await refresh()
      return null
    },
    [refresh],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, usingDefaults, refresh, saveSettings }),
    [settings, loading, usingDefaults, refresh, saveSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings doit être utilisé dans <SettingsProvider>')
  return ctx
}
