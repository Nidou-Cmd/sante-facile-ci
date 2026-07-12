import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateTime, PRESCRIPTION_STATUS } from '../../lib/labels'
import { supabase } from '../../lib/supabaseClient'
import type { Prescription } from '../../lib/database.types'

/** Module 5 (côté médecin) — Historique de mes e-prescriptions. */
export default function PrescriptionsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error: loadError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('medecin_id', userId)
      .order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setPrescriptions(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const cancelPrescription = async (id: string) => {
    setBusyId(id)
    const { error: updError } = await supabase
      .from('prescriptions')
      .update({ status: 'annulee' })
      .eq('id', id)
    if (updError) setError(updError.message)
    else await load()
    setBusyId(null)
  }

  return (
    <DashboardLayout title="Mes e-prescriptions" subtitle="Historique des ordonnances émises.">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/medecin" className="text-sm font-semibold text-emerald-700 hover:underline">
          ← Retour au tableau de bord
        </Link>
        <Link
          to="/medecin/prescriptions/nouvelle"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          + Nouvelle ordonnance
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : prescriptions.length === 0 ? (
        <p className="mt-6 rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-600">
          Aucune ordonnance émise pour le moment.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {prescriptions.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-gray-900">{p.patient_name || 'Patient'}</p>
                <p className="text-xs text-gray-500">
                  {formatDateTime(p.created_at)} ·{' '}
                  {p.pharmacy_name ? `→ ${p.pharmacy_name}` : 'pharmacie non assignée'}
                  {p.diagnosis && ` · ${p.diagnosis}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge {...PRESCRIPTION_STATUS[p.status]} />
                {p.status === 'emise' && (
                  <button
                    onClick={() => void cancelPrescription(p.id)}
                    disabled={busyId === p.id}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardLayout>
  )
}
