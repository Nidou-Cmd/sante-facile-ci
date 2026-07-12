import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { DELIVERY_STATUS, formatDateTime } from '../../lib/labels'
import { supabase } from '../../lib/supabaseClient'
import type { Delivery, DeliveryStatus } from '../../lib/database.types'

const STEPS: { key: DeliveryStatus; label: string; icon: string }[] = [
  { key: 'preparation', label: 'Préparation', icon: '📦' },
  { key: 'en_route', label: 'En route', icon: '🛵' },
  { key: 'livre', label: 'Livré', icon: '✅' },
]

function stepIndex(status: DeliveryStatus): number {
  return STEPS.findIndex((s) => s.key === status)
}

/** Module 7 — Suivi de livraison en TEMPS RÉEL (Supabase Realtime). */
export default function LivraisonsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [pharmacyNames, setPharmacyNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error: loadError } = await supabase
      .from('sante_deliveries')
      .select('*')
      .eq('patient_id', userId)
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }
    const rows = data ?? []
    setDeliveries(rows)
    // Nom de la pharmacie via l'ordonnance liée (lisible par le patient)
    if (rows.length > 0) {
      const { data: pres } = await supabase
        .from('prescriptions')
        .select('id, pharmacy_name')
        .in('id', rows.map((d) => d.prescription_id))
      const map: Record<string, string> = {}
      for (const p of pres ?? []) map[p.id] = p.pharmacy_name
      setPharmacyNames(map)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  // 🔴 Abonnement temps réel : tout changement sur MES livraisons recharge la liste
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`deliveries-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sante_deliveries', filter: `patient_id=eq.${userId}` },
        () => {
          void load()
        },
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load])

  return (
    <DashboardLayout
      title="Suivi de livraison"
      subtitle="Vos médicaments, suivis en direct : préparation → en route → livré."
    >
      <div className="flex items-center justify-between">
        <Link to="/patient" className="text-sm font-semibold text-emerald-700 hover:underline">
          ← Retour au tableau de bord
        </Link>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            live ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {live ? '● Temps réel actif' : '○ Connexion au temps réel…'}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : deliveries.length === 0 ? (
        <p className="mt-6 rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-600">
          Aucune livraison en cours. Dès qu'une pharmacie prépare une de vos ordonnances, le suivi
          apparaîtra ici automatiquement.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {deliveries.map((d) => {
            const currentStep = stepIndex(d.status)
            return (
              <li key={d.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-gray-900">
                    💊 {pharmacyNames[d.prescription_id] || 'Pharmacie partenaire'}
                  </p>
                  <StatusBadge {...DELIVERY_STATUS[d.status]} />
                </div>

                {/* Frise de progression */}
                <div className="mt-4 flex items-center">
                  {STEPS.map((step, i) => (
                    <div key={step.key} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${
                            i <= currentStep ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {step.icon}
                        </div>
                        <p
                          className={`mt-1 text-[11px] font-semibold ${
                            i <= currentStep ? 'text-emerald-700' : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={`mx-2 mb-5 h-1 flex-1 rounded ${
                            i < currentStep ? 'bg-emerald-500' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-1 text-xs text-gray-500 sm:grid-cols-3">
                  <p>Préparation : {formatDateTime(d.started_at)}</p>
                  <p>En route : {formatDateTime(d.en_route_at)}</p>
                  <p>Livré : {formatDateTime(d.delivered_at)}</p>
                </div>

                {d.courier_name && d.status !== 'preparation' && (
                  <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    🛵 Livreur : <strong>{d.courier_name}</strong>
                    {d.courier_phone && ` · ${d.courier_phone}`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </DashboardLayout>
  )
}
