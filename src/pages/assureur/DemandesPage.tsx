import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { COVERAGE_STATUS, formatDateTime } from '../../lib/labels'
import { useSettings } from '../../lib/settings'
import { supabase } from '../../lib/supabaseClient'
import type { CoverageRequest, Prescription, PrescriptionItem } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/**
 * Module 8 — Demandes de prise en charge : validation (totale /
 * partielle / refus) + historique des remboursements.
 */
export default function DemandesPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const userId = user?.id ?? null

  const [requests, setRequests] = useState<CoverageRequest[]>([])
  const [prescriptionsById, setPrescriptionsById] = useState<Record<string, Prescription>>({})
  const [itemsByPrescription, setItemsByPrescription] = useState<Record<string, PrescriptionItem[]>>({})
  const [forms, setForms] = useState<Record<string, { percent: string; amount: string; notes: string }>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error: loadError } = await supabase
      .from('coverage_requests')
      .select('*')
      .eq('insurer_profile_id', userId)
      .order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    const rows = data ?? []
    setRequests(rows)
    if (rows.length > 0) {
      const presIds = rows.map((r) => r.prescription_id)
      const [presRes, itemsRes] = await Promise.all([
        supabase.from('prescriptions').select('*').in('id', presIds),
        supabase.from('prescription_items').select('*').in('prescription_id', presIds),
      ])
      const pMap: Record<string, Prescription> = {}
      for (const p of presRes.data ?? []) pMap[p.id] = p
      setPrescriptionsById(pMap)
      const iMap: Record<string, PrescriptionItem[]> = {}
      for (const it of itemsRes.data ?? []) iMap[it.prescription_id] = [...(iMap[it.prescription_id] ?? []), it]
      setItemsByPrescription(iMap)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (
    request: CoverageRequest,
    status: 'approuvee_totale' | 'approuvee_partielle' | 'refusee',
  ) => {
    const form = forms[request.id] ?? { percent: '', amount: '', notes: '' }
    const coveredPercent =
      status === 'approuvee_totale'
        ? 100
        : status === 'approuvee_partielle'
          ? Math.min(99, Math.max(1, parseInt(form.percent, 10) || 50))
          : 0
    setBusyId(request.id)
    setError(null)
    const { error: updError } = await supabase
      .from('coverage_requests')
      .update({
        status,
        covered_percent: coveredPercent,
        amount_fcfa: form.amount.trim() ? Math.max(0, parseInt(form.amount, 10) || 0) : null,
        notes: form.notes.trim(),
        decided_at: new Date().toISOString(),
      })
      .eq('id', request.id)
    if (updError) setError(updError.message)
    else await load()
    setBusyId(null)
  }

  const pending = requests.filter((r) => r.status === 'en_attente')
  const decided = requests.filter((r) => r.status !== 'en_attente')

  const renderPrescription = (r: CoverageRequest) => {
    const prescription = prescriptionsById[r.prescription_id]
    const items = itemsByPrescription[r.prescription_id] ?? []
    return (
      <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        {prescription ? (
          <>
            <p className="text-xs text-gray-500">
              Ordonnance du {formatDateTime(prescription.created_at)} · Dr {prescription.medecin_name || '—'}
              {prescription.pharmacy_name && ` · ${prescription.pharmacy_name}`}
            </p>
            <ul className="mt-1 list-inside list-disc">
              {items.map((it) => (
                <li key={it.id}>
                  {it.medication_name}
                  {it.dosage && ` — ${it.dosage}`}
                  {it.duration && `, ${it.duration}`}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-gray-400">Ordonnance non consultable.</p>
        )}
      </div>
    )
  }

  return (
    <DashboardLayout
      title="Prises en charge & remboursements"
      subtitle={`Validez les demandes de vos assurés. Modèle de revenu (à valider) : ${settings.commissionPercent}% de commission par transaction validée, ou abonnement partenaire.`}
    >
      <Link to="/assureur" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : (
        <>
          {/* Demandes en attente */}
          <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5">
            <h2 className="font-bold text-amber-900">⏳ Demandes en attente ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800/70">Aucune demande en attente.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {pending.map((r) => {
                  const form = forms[r.id] ?? { percent: '', amount: '', notes: '' }
                  return (
                    <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">🧑🏾 {r.patient_name || 'Assuré'}</p>
                        <p className="text-xs text-gray-500">Demandé le {formatDateTime(r.created_at)}</p>
                      </div>
                      {renderPrescription(r)}
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div className="w-28">
                          <label className="mb-1 block text-xs font-semibold text-gray-600">% partiel</label>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={form.percent}
                            onChange={(e) => setForms((prev) => ({ ...prev, [r.id]: { ...form, percent: e.target.value } }))}
                            placeholder="50"
                            className={inputClass}
                          />
                        </div>
                        <div className="w-40">
                          <label className="mb-1 block text-xs font-semibold text-gray-600">Montant (FCFA)</label>
                          <input
                            type="number"
                            min={0}
                            value={form.amount}
                            onChange={(e) => setForms((prev) => ({ ...prev, [r.id]: { ...form, amount: e.target.value } }))}
                            placeholder="Optionnel"
                            className={inputClass}
                          />
                        </div>
                        <div className="min-w-44 flex-1">
                          <label className="mb-1 block text-xs font-semibold text-gray-600">Notes</label>
                          <input
                            type="text"
                            value={form.notes}
                            onChange={(e) => setForms((prev) => ({ ...prev, [r.id]: { ...form, notes: e.target.value } }))}
                            placeholder="Optionnel"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void decide(r, 'approuvee_totale')}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          ✅ Approuver 100%
                        </button>
                        <button
                          onClick={() => void decide(r, 'approuvee_partielle')}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          ➗ Approuver partiellement
                        </button>
                        <button
                          onClick={() => void decide(r, 'refusee')}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          ✕ Refuser
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Historique des remboursements */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900">🧾 Historique des décisions ({decided.length})</h2>
            {decided.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Aucune décision pour le moment.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {decided.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{r.patient_name || 'Assuré'}</p>
                      <p className="text-xs text-gray-500">
                        Décidé le {formatDateTime(r.decided_at)}
                        {r.amount_fcfa !== null && ` · ${r.amount_fcfa.toLocaleString('fr-FR')} FCFA`}
                        {r.notes && ` · ${r.notes}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge {...COVERAGE_STATUS[r.status]} />
                      {r.covered_percent !== null && r.status !== 'refusee' && (
                        <span className="text-xs font-bold text-gray-600">{r.covered_percent}%</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
