import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import type { Pharmacy, StockItem } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/** Module 6 — Gestion de stock basique de l'officine. */
export default function StockPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null)
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('0')
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const { data: pharmacyRow } = await supabase
      .from('pharmacies')
      .select('*')
      .eq('owner_profile_id', userId)
      .maybeSingle()
    setPharmacy(pharmacyRow)
    if (pharmacyRow) {
      const { data, error: stockError } = await supabase
        .from('stock_items')
        .select('*')
        .eq('pharmacy_id', pharmacyRow.id)
        .order('medication_name', { ascending: true })
      if (stockError) setError(stockError.message)
      setItems(data ?? [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const addItem = async (e: FormEvent) => {
    e.preventDefault()
    if (!pharmacy) return
    if (!newName.trim()) {
      setError('Renseignez le nom du médicament.')
      return
    }
    setAdding(true)
    setError(null)
    const { error: insertError } = await supabase.from('stock_items').insert({
      pharmacy_id: pharmacy.id,
      medication_name: newName.trim(),
      quantity: Math.max(0, parseInt(newQty, 10) || 0),
      price_fcfa: newPrice.trim() ? Math.max(0, parseInt(newPrice, 10) || 0) : null,
    })
    setAdding(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewName('')
    setNewQty('0')
    setNewPrice('')
    void load()
  }

  const changeQty = async (item: StockItem, delta: number) => {
    const quantity = Math.max(0, item.quantity + delta)
    const { error: updError } = await supabase.from('stock_items').update({ quantity }).eq('id', item.id)
    if (updError) setError(updError.message)
    else setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, quantity } : it)))
  }

  const removeItem = async (id: string) => {
    const { error: delError } = await supabase.from('stock_items').delete().eq('id', id)
    if (delError) setError(delError.message)
    else setItems((prev) => prev.filter((it) => it.id !== id))
  }

  return (
    <DashboardLayout title="Gestion de stock" subtitle="Suivi basique des médicaments de votre officine.">
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
          Créez d'abord votre fiche officine.{' '}
          <Link to="/pharmacie/fiche" className="font-bold underline">
            Créer ma fiche →
          </Link>
        </div>
      ) : (
        <>
          {/* Ajout */}
          <form
            onSubmit={addItem}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            noValidate
          >
            <div className="min-w-56 flex-[2]">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Médicament</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex : Paracétamol 500 mg"
                className={inputClass}
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Quantité</label>
              <input
                type="number"
                min={0}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="w-36">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Prix (FCFA)</label>
              <input
                type="number"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Optionnel"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {adding ? '…' : '+ Ajouter'}
            </button>
          </form>

          {/* Liste */}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Médicament</th>
                  <th className="px-4 py-3">Quantité</th>
                  <th className="px-4 py-3">Prix (FCFA)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.id} className={it.quantity === 0 ? 'bg-red-50/50' : ''}>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {it.medication_name}
                      {it.quantity === 0 && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                          Rupture
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void changeQty(it, -1)}
                          className="h-7 w-7 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-50"
                        >
                          −
                        </button>
                        <span className="w-10 text-center font-bold text-gray-900">{it.quantity}</span>
                        <button
                          onClick={() => void changeQty(it, 1)}
                          className="h-7 w-7 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {it.price_fcfa !== null ? it.price_fcfa.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void removeItem(it.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-500">Aucun médicament en stock pour le moment.</p>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
