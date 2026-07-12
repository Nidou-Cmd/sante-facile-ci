import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings, type MobileMoneySettings } from '../../lib/settings'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function Section({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-gray-900">
        {icon} {title}
      </h2>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

/**
 * ⚙️ Paramètres système (admin uniquement — RLS `sante_settings`).
 * Permet de modifier sans redéploiement : numéros d'urgence, seuil
 * du fallback urgence, serveur Jitsi, commission, textes légaux,
 * identifiants mobile money.
 */
export default function SettingsPage() {
  const { settings, loading, usingDefaults, saveSettings } = useSettings()

  // Copies locales éditables
  const [samu, setSamu] = useState('')
  const [pompiers, setPompiers] = useState('')
  const [police, setPolice] = useState('')
  const [fallbackSec, setFallbackSec] = useState('240')
  const [jitsiUrl, setJitsiUrl] = useState('')
  const [commission, setCommission] = useState('2')
  const [mentions, setMentions] = useState('')
  const [confidentialite, setConfidentialite] = useState('')
  const [cgu, setCgu] = useState('')
  const [mm, setMm] = useState<MobileMoneySettings>(settings.mobileMoney)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Pré-remplissage quand les paramètres sont chargés
  useEffect(() => {
    if (loading) return
    setSamu(settings.emergencyNumbers.samu)
    setPompiers(settings.emergencyNumbers.pompiers)
    setPolice(settings.emergencyNumbers.police)
    setFallbackSec(String(settings.emergencyFallbackSeconds))
    setJitsiUrl(settings.jitsiBaseUrl)
    setCommission(String(settings.commissionPercent))
    setMentions(settings.legalMentions)
    setConfidentialite(settings.legalConfidentialite)
    setCgu(settings.legalCgu)
    setMm(settings.mobileMoney)
  }, [loading, settings])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    // Validations minimales
    const sec = parseInt(fallbackSec, 10)
    if (!samu.trim() || !pompiers.trim() || !police.trim()) {
      setMessage({ type: 'error', text: 'Les trois numéros d’urgence sont obligatoires.' })
      return
    }
    if (Number.isNaN(sec) || sec < 60 || sec > 3600) {
      setMessage({ type: 'error', text: 'Le seuil du fallback urgence doit être entre 60 et 3600 secondes.' })
      return
    }
    const com = Number(commission.replace(',', '.'))
    if (Number.isNaN(com) || com < 0 || com > 100) {
      setMessage({ type: 'error', text: 'La commission doit être comprise entre 0 et 100 %.' })
      return
    }
    let url = jitsiUrl.trim().replace(/\/$/, '')
    if (!/^https:\/\/[^\s]+$/.test(url)) {
      setMessage({ type: 'error', text: 'L’URL Jitsi doit commencer par https://' })
      return
    }

    setSaving(true)
    setMessage(null)
    const error = await saveSettings({
      emergency_numbers: { samu: samu.trim(), pompiers: pompiers.trim(), police: police.trim() },
      emergency_fallback_seconds: sec,
      jitsi_base_url: url,
      commission_percent: com,
      legal_mentions: mentions,
      legal_confidentialite: confidentialite,
      legal_cgu: cgu,
      mobile_money: { ...mm },
    })
    setSaving(false)
    setMessage(
      error
        ? { type: 'error', text: `Enregistrement impossible : ${error}` }
        : { type: 'success', text: 'Paramètres enregistrés ✔ — appliqués immédiatement dans toute l’application.' },
    )
  }

  const mmField = (
    label: string,
    enabledKey: keyof MobileMoneySettings,
    idKey: keyof MobileMoneySettings,
    linkKey: keyof MobileMoneySettings,
  ) => (
    <div className="rounded-xl border border-gray-200 p-4">
      <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
        <input
          type="checkbox"
          checked={mm[enabledKey] as boolean}
          onChange={(e) => setMm((prev) => ({ ...prev, [enabledKey]: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        {label}
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Identifiant marchand</label>
          <input
            type="text"
            value={mm[idKey] as string}
            onChange={(e) => setMm((prev) => ({ ...prev, [idKey]: e.target.value }))}
            placeholder="Ex : SF-MERCHANT-001"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Lien de paiement</label>
          <input
            type="text"
            value={mm[linkKey] as string}
            onChange={(e) => setMm((prev) => ({ ...prev, [linkKey]: e.target.value }))}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout
      title="⚙️ Paramètres système"
      subtitle="Modifiez ces valeurs à tout moment — elles s'appliquent immédiatement, sans intervention technique."
    >
      <Link to="/admin" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour à l'administration
      </Link>

      {usingDefaults && !loading && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠️ Valeurs par défaut du code affichées : la table des paramètres est vide ou la migration
          010_parametres_systeme.sql n'a pas encore été exécutée. L'enregistrement la remplira.
        </p>
      )}

      <form onSubmit={handleSave} className="mt-4 space-y-5" noValidate>
        <Section
          icon="🚨"
          title="Numéros d'urgence"
          subtitle="Affichés au patient (bouton Urgence, fallback, pieds de page, pages légales). Vérifiés via sources publiques — à confirmer officiellement."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">SAMU</label>
              <input type="text" value={samu} onChange={(e) => setSamu(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Pompiers</label>
              <input type="text" value={pompiers} onChange={(e) => setPompiers(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Police</label>
              <input type="text" value={police} onChange={(e) => setPolice(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Seuil du fallback urgence (secondes)
            </label>
            <input
              type="number"
              min={60}
              max={3600}
              value={fallbackSec}
              onChange={(e) => setFallbackSec(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Délai d'attente sans médecin au-delà duquel les numéros de secours sont mis en avant
              chez le patient (60 à 3600 s).
            </p>
          </div>
        </Section>

        <Section
          icon="🎥"
          title="Vidéoconsultation"
          subtitle="Serveur Jitsi utilisé pour toutes les salles. Prototype : meet.jit.si — production : serveur dédié/JaaS recommandé."
        >
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">URL du serveur Jitsi</label>
            <input
              type="text"
              value={jitsiUrl}
              onChange={(e) => setJitsiUrl(e.target.value)}
              placeholder="https://jitsi.votre-domaine.ci"
              className={inputClass}
            />
          </div>
        </Section>

        <Section
          icon="💰"
          title="Monétisation"
          subtitle="Commission indicative par transaction validée (affichée côté assureur). Facturation automatique : à venir."
        >
          <div className="max-w-48">
            <label className="mb-1 block text-sm font-semibold text-gray-700">Commission (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className={inputClass}
            />
          </div>
        </Section>

        <Section
          icon="📱"
          title="Mobile money"
          subtitle="Identifiants et liens de paiement — préparés pour le module de paiement (P1). Tant que le module n'est pas actif, ces valeurs sont stockées mais non utilisées. ⚠️ Ne saisissez ici AUCUNE clé API secrète."
        >
          {mmField('Wave', 'wave_enabled', 'wave_merchant_id', 'wave_payment_link')}
          {mmField('Orange Money', 'om_enabled', 'om_merchant_id', 'om_payment_link')}
          {mmField('MTN MoMo', 'mtn_enabled', 'mtn_merchant_id', 'mtn_payment_link')}
        </Section>

        <Section
          icon="⚖️"
          title="Textes légaux"
          subtitle="Contenu des pages publiques. Paragraphes séparés par une ligne vide ; les lignes EN MAJUSCULES deviennent des titres de section. À faire valider par un juriste avant publication."
        >
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Mentions légales</label>
            <textarea rows={8} value={mentions} onChange={(e) => setMentions(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">
              Politique de confidentialité & données de santé
            </label>
            <textarea rows={8} value={confidentialite} onChange={(e) => setConfidentialite(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Conditions générales d'utilisation</label>
            <textarea rows={8} value={cgu} onChange={(e) => setCgu(e.target.value)} className={inputClass} />
          </div>
        </Section>

        {message && (
          <p
            role="alert"
            className={`rounded-lg px-3 py-2 text-sm ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : '💾 Enregistrer tous les paramètres'}
        </button>
      </form>
    </DashboardLayout>
  )
}
