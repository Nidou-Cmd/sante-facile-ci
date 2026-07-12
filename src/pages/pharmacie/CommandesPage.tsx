import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateTime, PRESCRIPTION_STATUS } from '../../lib/labels'
import { supabase } from '../../lib/supabaseClient'
import type { Delivery, Pharmacy, Prescription, PrescriptionItem, StockItem } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/**
 * Module 6 — Commandes de la pharmacie : réception des e-prescriptions,
 * préparation, déclenchement de la livraison (Module 7).
 */
export default function CommandesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [itemsByPrescription, setItemsByPrescription] = useState<Record<string, PrescriptionItem[]>>({})
  const [deliveriesByPrescription, setDeliveriesByPrescription] = useState<Record<string, Delivery>>({})
  const [stock, setStock] = useState<StockItem[]>([])
  const [courierForms, setCourierForms] = useState<Record<string, { name: string; phone: string }>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const { data: pharmacyRow } = await supabase
      .from('pharmacies')
      .select('*')
      .eq('owner_profile_id', userId)
      .maybeSingle()
    setPharmacy(pharmacyRow)
    if (!pharmacyRow) {
      setLoading(false)
      return
    }
    const [presRes, delRes, stockRes] = await Promise.all([
      supabase
        .from('prescriptions')
        .select('*')
        .eq('pharmacy_id', pharmacyRow.id)
        .order('created_at', { ascending: false }),
      supabase.from('sante_deliveries').select('*').eq('pharmacy_id', pharmacyRow.id),
      supabase.from('stock_items').select('*').eq('pharmacy_id', pharmacyRow.id),
    ])
    setStock(stockRes.data ?? [])
    if (presRes.error) setError(presRes.error.message)
    const pres = presRes.data ?? []
    setPrescriptions(pres)
    const delMap: Record<string, Delivery> = {}
    for (const d of delRes.data ?? []) delMap[d.prescription_id] = d
    setDeliveriesByPrescription(delMap)
    if (pres.length > 0) {
      const { data: items } = await supabase
        .from('prescription_items')
        .select('*')
        .in('prescription_id', pres.map((p) => p.id))
      const map: Record<string, PrescriptionItem[]> = {}
      for (const it of items ?? []) map[it.prescription_id] = [...(map[it.prescription_id] ?? []), it]
      setItemsByPrescription(map)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  // Nouvelles ordonnances en temps réel (la table prescriptions n'est pas
  // dans la publication Realtime : on écoute les livraisons + on recharge
  // périodiquement — simple et robuste pour un MVP).
  useEffect(() => {
    const interval = window.setInterval(() => {
      void load()
    }, 20000)
    return () => window.clearInterval(interval)
  }, [load])

  /** P0 — Correspondance souple d'un médicament prescrit avec le stock de l'officine. */
  const findStockMatch = (medicationName: string): StockItem | null => {
    const n = medicationName.trim().toLowerCase()
    return (
      stock.find((s) => {
        const sn = s.medication_name.trim().toLowerCase()
        return sn === n || sn.includes(n) || n.includes(sn)
      }) ?? null
    )
  }

  const availability = (medicationName: string): { label: string; cls: string; ok: boolean } => {
    const match = findStockMatch(medicationName)
    if (!match) return { label: 'Non référencé', cls: 'bg-gray-100 text-gray-500', ok: false }
    if (match.quantity <= 0) return { label: 'Rupture', cls: 'bg-red-100 text-red-700', ok: false }
    return { label: `En stock (${match.quantity})`, cls: 'bg-emerald-100 text-emerald-700', ok: true }
  }

  const startPreparation = async (p: Prescription) => {
    if (!pharmacy) return
    // P0 — Contrôle stock↔commande AVANT acceptation
    const items = itemsByPrescription[p.id] ?? []
    const missing = items.filter((it) => !availability(it.medication_name).ok)
    if (missing.length > 0) {
      const proceed = window.confirm(
        `⚠️ ${missing.length} médicament(s) indisponible(s) ou non référencé(s) dans votre stock :\n` +
          missing.map((it) => `• ${it.medication_name}`).join('\n') +
          `\n\nAccepter quand même la commande ?\n(Sinon : réapprovisionnez, proposez un équivalent au médecin via la messagerie, ou laissez la commande à une autre officine.)`,
      )
      if (!proceed) return
    }
    setBusyId(p.id)
    setError(null)
    const { error: delError } = await supabase.from('sante_deliveries').insert({
      prescription_id: p.id,
      pharmacy_id: pharmacy.id,
      patient_id: p.patient_id,
    })
    if (delError) {
      setError(`Préparation impossible : ${delError.message}`)
      setBusyId(null)
      return
    }
    await supabase.from('prescriptions').update({ status: 'en_preparation' }).eq('id', p.id)
    // P0 — Décrémentation du stock (1 unité par ligne correspondante, best-effort MVP)
    for (const it of items) {
      const match = findStockMatch(it.medication_name)
      if (match && match.quantity > 0) {
        await supabase.from('stock_items').update({ quantity: match.quantity - 1 }).eq('id', match.id)
      }
    }
    await load()
    setBusyId(null)
  }

  const sendDelivery = async (p: Prescription) => {
    const delivery = deliveriesByPrescription[p.id]
    const form = courierForms[p.id]
    if (!delivery) return
    if (!form?.name.trim()) {
      setError('Renseignez le nom du livreur avant l’envoi.')
      return
    }
    setBusyId(p.id)
    setError(null)
    const { error: updError } = await supabase
      .from('sante_deliveries')
      .update({
        courier_name: form.name.trim(),
        courier_phone: form.phone.trim(),
        status: 'en_route',
        en_route_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)
    if (updError) setError(updError.message)
    else await supabase.from('prescriptions').update({ status: 'en_livraison' }).eq('id', p.id)
    await load()
    setBusyId(null)
  }

  const markDelivered = async (p: Prescription) => {
    const delivery = deliveriesByPrescription[p.id]
    if (!delivery) return
    setBusyId(p.id)
    const { error: updError } = await supabase
      .from('sante_deliveries')
      .update({ status: 'livre', delivered_at: new Date().toISOString() })
      .eq('id', delivery.id)
    if (updError) setError(updError.message)
    else await supabase.from('prescriptions').update({ status: 'livree' }).eq('id', p.id)
    await load()
    setBusyId(null)
  }

  return (
    <DashboardLayout
      title="Commandes entrantes"
      subtitle="E-prescriptions reçues → préparation → livraison suivie en temps réel par le patient."
    >
      <Link to="/pharmacie" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : !pharmacy ? (
        <div className="mt-6 rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-800">
          Créez d'abord votre fiche officine pour recevoir des ordonnances.{' '}
          <Link to="/pharmacie/fiche" className="font-bold underline">
            Créer ma fiche →
          </Link>
        </div>
      ) : prescriptions.length === 0 ? (
        <p className="mt-6 rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-600">
          Aucune ordonnance reçue pour le moment. Les e-prescriptions adressées à «{' '}
          {pharmacy.name} » apparaîtront ici (actualisation automatique).
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {prescriptions.map((p) => {
            const items = itemsByPrescription[p.id] ?? []
            const form = courierForms[p.id] ?? { name: '', phone: '' }
            return (
              <li key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">
                      {p.patient_name || 'Patient'}{' '}
                      <span className="font-normal text-gray-400">· Dr {p.medecin_name || '—'}</span>
                    </p>
                    <p className="text-xs text-gray-500">Reçue le {formatDateTime(p.created_at)}</p>
                  </div>
                  <StatusBadge {...PRESCRIPTION_STATUS[p.status]} />
                </div>

                <ul className="mt-3 space-y-1.5 text-sm">
                  {items.map((it) => {
                    const avail = availability(it.medication_name)
                    return (
                      <li key={it.id} className="flex flex-wrap items-center gap-2 text-gray-700">
                        <span>
                          💊 <strong>{it.medication_name}</strong>
                          {it.dosage && ` — ${it.dosage}`}
                          {it.frequency && `, ${it.frequency}`}
                          {it.duration && `, pendant ${it.duration}`}
                          {it.instructions && ` (${it.instructions})`}
                        </span>
                        {(p.status === 'emise' || p.status === 'en_preparation') && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${avail.cls}`}>
                            {avail.label}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  {p.status === 'emise' && (
                    <button
                      onClick={() => void startPreparation(p)}
                      disabled={busyId === p.id}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
                    >
                      {busyId === p.id ? '…' : '📦 Accepter & préparer la commande'}
                    </button>
                  )}
                  {p.status === 'en_preparation' && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-44 flex-1">
                        <label className="mb-1 block text-xs font-semibold text-gray-600">Nom du livreur</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) =>
                            setCourierForms((prev) => ({ ...prev, [p.id]: { ...form, name: e.target.value } }))
                          }
                          placeholder="Ex : Yao Kof"
                          className={inputClass}
                        />
                      </div>
                      <div className="min-w-44 flex-1">
                        <label className="mb-1 block text-xs font-semibold text-gray-600">Téléphone livreur</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) =>
                            setCourierForms((prev) => ({ ...prev, [p.id]: { ...form, phone: e.target.value } }))
                          }
                          placeholder="+225 07 …"
                          className={inputClass}
                        />
                      </div>
                      <button
                        onClick={() => void sendDelivery(p)}
                        disabled={busyId === p.id}
                        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        {busyId === p.id ? '…' : '🛵 Envoyer en livraison'}
                      </button>
                    </div>
                  )}
                  {p.status === 'en_livraison' && (
                    <button
                      onClick={() => void markDelivered(p)}
                      disabled={busyId === p.id}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {busyId === p.id ? '…' : '✅ Marquer comme livrée'}
                    </button>
                  )}
                  {p.status === 'livree' && (
                    <p className="text-sm font-semibold text-emerald-700">✅ Commande livrée au patient.</p>
                  )}
                  {p.status === 'annulee' && (
                    <p className="text-sm text-gray-500">Ordonnance annulée par le médecin.</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardLayout>
  )
}
