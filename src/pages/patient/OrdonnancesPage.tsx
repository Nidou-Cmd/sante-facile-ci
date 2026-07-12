import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { COVERAGE_STATUS, formatDateTime, PRESCRIPTION_STATUS } from '../../lib/labels'
import { supabase } from '../../lib/supabaseClient'
import type {
  CoverageRequest,
  InsurancePolicy,
  Prescription,
  PrescriptionItem,
} from '../../lib/database.types'

/** Module 5 (côté patient) + Module 8 (demande de prise en charge). */
export default function OrdonnancesPage() {
  const { user, profile } = useAuth()
  const userId = user?.id ?? null

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [itemsByPrescription, setItemsByPrescription] = useState<Record<string, PrescriptionItem[]>>({})
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [requestsByPrescription, setRequestsByPrescription] = useState<Record<string, CoverageRequest>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [printable, setPrintable] = useState<Prescription | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const [presRes, polRes, covRes] = await Promise.all([
      supabase.from('prescriptions').select('*').eq('patient_id', userId).order('created_at', { ascending: false }),
      supabase.from('insurance_policies').select('*').eq('patient_id', userId).eq('status', 'actif'),
      supabase.from('coverage_requests').select('*').eq('patient_id', userId),
    ])
    if (presRes.error) setError(presRes.error.message)
    const pres = presRes.data ?? []
    setPrescriptions(pres)
    setPolicies(polRes.data ?? [])
    const reqMap: Record<string, CoverageRequest> = {}
    for (const r of covRes.data ?? []) reqMap[r.prescription_id] = r
    setRequestsByPrescription(reqMap)

    if (pres.length > 0) {
      const { data: items } = await supabase
        .from('prescription_items')
        .select('*')
        .in('prescription_id', pres.map((p) => p.id))
      const map: Record<string, PrescriptionItem[]> = {}
      for (const it of items ?? []) {
        map[it.prescription_id] = [...(map[it.prescription_id] ?? []), it]
      }
      setItemsByPrescription(map)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const requestCoverage = async (prescription: Prescription) => {
    if (!userId) return
    const policy = policies[0]
    if (!policy) return
    setBusyId(prescription.id)
    setError(null)
    const { error: insertError } = await supabase.from('coverage_requests').insert({
      prescription_id: prescription.id,
      policy_id: policy.id,
      insurer_profile_id: policy.insurer_profile_id,
      patient_id: userId,
      patient_name: profile?.full_name ?? '',
    })
    if (insertError) setError(`Demande impossible : ${insertError.message}`)
    else await load()
    setBusyId(null)
  }

  const printPrescription = (p: Prescription) => {
    setPrintable(p)
    window.setTimeout(() => {
      window.print()
      setPrintable(null)
    }, 150)
  }

  return (
    <DashboardLayout
      title="Mes ordonnances"
      subtitle="Vos prescriptions électroniques, envoyées automatiquement à votre pharmacie."
    >
      <Link to="/patient" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : prescriptions.length === 0 ? (
        <p className="mt-6 rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-600">
          Aucune ordonnance pour le moment — elles apparaîtront ici après vos consultations.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {prescriptions.map((p) => {
            const items = itemsByPrescription[p.id] ?? []
            const request = requestsByPrescription[p.id]
            return (
              <li key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">Ordonnance du {formatDateTime(p.created_at)}</p>
                    <p className="text-xs text-gray-500">
                      Dr {p.medecin_name || '—'}
                      {p.pharmacy_name ? ` · Pharmacie : ${p.pharmacy_name}` : ' · Pharmacie : non assignée'}
                    </p>
                  </div>
                  <StatusBadge {...PRESCRIPTION_STATUS[p.status]} />
                </div>

                {p.diagnosis && <p className="mt-2 text-sm text-gray-600">Diagnostic : {p.diagnosis}</p>}

                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-1">Médicament</th>
                      <th className="py-1">Dosage</th>
                      <th className="py-1">Fréquence</th>
                      <th className="py-1">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-1.5 font-semibold text-gray-800">{it.medication_name}</td>
                        <td className="py-1.5 text-gray-600">{it.dosage || '—'}</td>
                        <td className="py-1.5 text-gray-600">{it.frequency || '—'}</td>
                        <td className="py-1.5 text-gray-600">{it.duration || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => printPrescription(p)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    🖨️ Imprimer / PDF
                  </button>
                  {request ? (
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      🛡️ Prise en charge : <StatusBadge {...COVERAGE_STATUS[request.status]} />
                      {request.covered_percent !== null && ` ${request.covered_percent}%`}
                    </span>
                  ) : policies.length > 0 ? (
                    <button
                      onClick={() => void requestCoverage(p)}
                      disabled={busyId === p.id}
                      className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                    >
                      {busyId === p.id ? 'Envoi…' : `🛡️ Demander la prise en charge (${policies[0].insurer_name || 'assureur'})`}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">
                      🛡️ Aucune police d'assurance active — demandez à votre assureur partenaire de vous enregistrer.
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Version imprimable (PDF via impression navigateur) */}
      {printable && (
        <div className="printable bg-white p-8">
          <h1 className="text-xl font-extrabold">Santé Facile — Ordonnance électronique</h1>
          <p className="mt-1 text-sm">
            N° {printable.id}
            <br />
            Émise le {formatDateTime(printable.created_at)}
          </p>
          <hr className="my-4" />
          <p className="text-sm">
            <strong>Médecin :</strong> Dr {printable.medecin_name || '—'}
            <br />
            <strong>Patient :</strong> {printable.patient_name || '—'}
            <br />
            <strong>Pharmacie destinataire :</strong> {printable.pharmacy_name || 'Non assignée'}
          </p>
          {printable.diagnosis && (
            <p className="mt-2 text-sm">
              <strong>Diagnostic :</strong> {printable.diagnosis}
            </p>
          )}
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-400 p-2 text-left">Médicament</th>
                <th className="border border-gray-400 p-2 text-left">Dosage</th>
                <th className="border border-gray-400 p-2 text-left">Fréquence</th>
                <th className="border border-gray-400 p-2 text-left">Durée</th>
                <th className="border border-gray-400 p-2 text-left">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {(itemsByPrescription[printable.id] ?? []).map((it) => (
                <tr key={it.id}>
                  <td className="border border-gray-400 p-2">{it.medication_name}</td>
                  <td className="border border-gray-400 p-2">{it.dosage}</td>
                  <td className="border border-gray-400 p-2">{it.frequency}</td>
                  <td className="border border-gray-400 p-2">{it.duration}</td>
                  <td className="border border-gray-400 p-2">{it.instructions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 text-xs">
            Document généré par Santé Facile (sante-facile-ci). La validité juridique de
            l'ordonnance électronique en Côte d'Ivoire est un point à faire valider par un juriste
            local.
          </p>
        </div>
      )}
    </DashboardLayout>
  )
}
