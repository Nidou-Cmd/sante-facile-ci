import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../lib/labels'
import { supabase } from '../../lib/supabaseClient'
import type { InsurancePolicy } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/**
 * Module 8 — Polices d'assurance : vérification d'éligibilité
 * (recherche du patient par e-mail) + enregistrement des assurés.
 */
export default function PolicesPage() {
  const { user, profile } = useAuth()
  const userId = user?.id ?? null

  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchEmail, setSearchEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundPatient, setFoundPatient] = useState<{ id: string; full_name: string } | null | 'none'>(null)

  const [coveragePercent, setCoveragePercent] = useState('80')
  const [validUntil, setValidUntil] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error: loadError } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('insurer_profile_id', userId)
      .order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setPolicies(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const searchPatient = async (e: FormEvent) => {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setSearching(true)
    setError(null)
    setFoundPatient(null)
    const { data, error: rpcError } = await supabase.rpc('find_patient_by_email', {
      p_email: searchEmail.trim(),
    })
    setSearching(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setFoundPatient(data && data.length > 0 ? data[0] : 'none')
  }

  const createPolicy = async () => {
    if (!userId || !foundPatient || foundPatient === 'none') return
    setCreating(true)
    setError(null)
    const policyNumber = `POL-${Date.now().toString(36).toUpperCase()}`
    const { error: insertError } = await supabase.from('insurance_policies').insert({
      insurer_profile_id: userId,
      patient_id: foundPatient.id,
      insurer_name: profile?.full_name ?? '',
      patient_name: foundPatient.full_name,
      policy_number: policyNumber,
      coverage_percent: Math.min(100, Math.max(0, parseInt(coveragePercent, 10) || 80)),
      valid_until: validUntil || null,
    })
    setCreating(false)
    if (insertError) {
      setError(
        insertError.message.includes('duplicate') || insertError.message.includes('unique')
          ? 'Ce patient est déjà couvert par votre organisme.'
          : insertError.message,
      )
      return
    }
    setFoundPatient(null)
    setSearchEmail('')
    void load()
  }

  const togglePolicy = async (p: InsurancePolicy) => {
    const { error: updError } = await supabase
      .from('insurance_policies')
      .update({ status: p.status === 'actif' ? 'suspendu' : 'actif' })
      .eq('id', p.id)
    if (updError) setError(updError.message)
    else void load()
  }

  return (
    <DashboardLayout
      title="Polices & éligibilité"
      subtitle="Recherchez un patient par e-mail, vérifiez son éligibilité et enregistrez sa police."
    >
      <Link to="/assureur" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Vérification d'éligibilité */}
      <form
        onSubmit={searchPatient}
        className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        noValidate
      >
        <h2 className="font-bold text-gray-900">✅ Vérifier l'éligibilité d'un patient</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="mb-1 block text-xs font-semibold text-gray-600">E-mail du patient</label>
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="patient@exemple.ci"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {searching ? 'Recherche…' : 'Rechercher'}
          </button>
        </div>

        {foundPatient === 'none' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aucun patient trouvé avec cet e-mail sur Santé Facile.
          </p>
        )}
        {foundPatient && foundPatient !== 'none' && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-900">🧑🏾 {foundPatient.full_name}</p>
            {policies.some((p) => p.patient_id === foundPatient.id) ? (
              <p className="mt-1 text-sm text-emerald-800">
                ✔ Déjà couvert par votre organisme (voir la liste ci-dessous).
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="w-36">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Couverture (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={coveragePercent}
                    onChange={(e) => setCoveragePercent(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="w-44">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Valide jusqu'au</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void createPolicy()}
                  disabled={creating}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? '…' : '➕ Enregistrer la police'}
                </button>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Liste des polices */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Police</th>
              <th className="px-4 py-3">Assuré</th>
              <th className="px-4 py-3">Couverture</th>
              <th className="px-4 py-3">Validité</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {policies.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.policy_number}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{p.patient_name || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{p.coverage_percent}%</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(p.valid_until)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.status === 'actif' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p.status === 'actif' ? 'Actif' : 'Suspendu'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => void togglePolicy(p)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    {p.status === 'actif' ? 'Suspendre' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && policies.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">Aucune police enregistrée pour le moment.</p>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        🤝 Les partenariats réels avec les assureurs sont à négocier séparément — la recherche
        d'éligibilité n'expose que le nom du patient correspondant à l'e-mail fourni.
      </p>
    </DashboardLayout>
  )
}
