import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

interface ItemForm {
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

const emptyItem = (): ItemForm => ({
  medication_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
})

interface RecentPatient {
  id: string
  name: string
}

/**
 * Module 5 — Rédaction d'une e-prescription :
 * médecin → médicaments → pharmacie du patient sélectionnée
 * AUTOMATIQUEMENT (préférée, sinon la plus proche) → envoi numérique.
 */
export default function PrescriptionNewPage() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const userId = user?.id ?? null

  const [patientId, setPatientId] = useState(searchParams.get('patient') ?? '')
  const [patientName, setPatientName] = useState(searchParams.get('nom') ?? '')
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([])
  const appointmentId = searchParams.get('rdv')

  const [diagnosis, setDiagnosis] = useState('')
  const [items, setItems] = useState<ItemForm[]>([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ pharmacyName: string | null } | null>(null)

  // Patients récents du médecin (issus de ses rendez-vous)
  useEffect(() => {
    if (!userId) return
    void (async () => {
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, patient_name')
        .eq('medecin_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      const seen = new Map<string, string>()
      for (const a of data ?? []) {
        if (!seen.has(a.patient_id)) seen.set(a.patient_id, a.patient_name || 'Patient')
      }
      setRecentPatients([...seen.entries()].map(([id, name]) => ({ id, name })))
    })()
  }, [userId])

  const updateItem = (index: number, patch: Partial<ItemForm>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!patientId) {
      setError('Veuillez choisir un patient.')
      return
    }
    const validItems = items.filter((it) => it.medication_name.trim())
    if (validItems.length === 0) {
      setError('Ajoutez au moins un médicament.')
      return
    }
    setSubmitting(true)
    setError(null)

    // 1. Sélection AUTOMATIQUE de la pharmacie du patient
    const { data: pharmacyRows, error: pharmacyError } = await supabase.rpc(
      'select_pharmacy_for_patient',
      { p_patient: patientId },
    )
    if (pharmacyError) {
      setError(`Sélection de pharmacie : ${pharmacyError.message}`)
      setSubmitting(false)
      return
    }
    const pharmacy = pharmacyRows?.[0] ?? null

    // 2. Création de l'ordonnance
    const { data: created, error: insertError } = await supabase
      .from('prescriptions')
      .insert({
        appointment_id: appointmentId,
        patient_id: patientId,
        medecin_id: userId,
        pharmacy_id: pharmacy?.pharmacy_id ?? null,
        patient_name: patientName,
        medecin_name: profile?.full_name ?? '',
        pharmacy_name: pharmacy?.pharmacy_name ?? '',
        diagnosis: diagnosis.trim(),
      })
      .select('id')
      .single()
    if (insertError || !created) {
      setError(`Création impossible : ${insertError?.message ?? 'erreur inconnue'}`)
      setSubmitting(false)
      return
    }

    // 3. Lignes de l'ordonnance
    const { error: itemsError } = await supabase.from('prescription_items').insert(
      validItems.map((it) => ({
        prescription_id: created.id,
        medication_name: it.medication_name.trim(),
        dosage: it.dosage.trim(),
        frequency: it.frequency.trim(),
        duration: it.duration.trim(),
        instructions: it.instructions.trim(),
      })),
    )
    setSubmitting(false)
    if (itemsError) {
      setError(`Médicaments : ${itemsError.message}`)
      return
    }
    setSuccessInfo({ pharmacyName: pharmacy?.pharmacy_name ?? null })
  }

  if (successInfo) {
    return (
      <DashboardLayout title="Ordonnance envoyée ✔" subtitle="La prescription électronique a été transmise.">
        <div className="max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="text-3xl">📤</div>
          <p className="mt-2 font-semibold text-emerald-900">
            {successInfo.pharmacyName
              ? `Ordonnance envoyée numériquement à « ${successInfo.pharmacyName} » — aucune impression papier nécessaire.`
              : "Ordonnance créée. ⚠️ Le patient n'a pas encore d'adresse/pharmacie enregistrée : aucune officine n'a pu être sélectionnée automatiquement (il pourra le faire depuis son profil, ou l'admin assignera la fiche)."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/medecin/prescriptions"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Voir mes ordonnances
            </Link>
            <Link
              to="/medecin"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Tableau de bord
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Nouvelle e-prescription"
      subtitle="Envoyée automatiquement à la pharmacie du patient (préférée, sinon la plus proche)."
    >
      <Link to="/medecin" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      <form onSubmit={handleSubmit} className="mt-4 max-w-3xl space-y-4" noValidate>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900">🧑🏾 Patient</h2>
          <div className="mt-3">
            {searchParams.get('patient') ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                {patientName || 'Patient'} (issu de la consultation)
              </p>
            ) : (
              <select
                value={patientId}
                onChange={(e) => {
                  setPatientId(e.target.value)
                  setPatientName(recentPatients.find((p) => p.id === e.target.value)?.name ?? '')
                }}
                className={inputClass}
              >
                <option value="">— Choisir parmi mes patients récents —</option>
                {recentPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-3">
            <label htmlFor="diagnosis" className="mb-1 block text-sm font-semibold text-gray-700">
              Diagnostic / observations
            </label>
            <textarea
              id="diagnosis"
              rows={2}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Ex : paludisme simple confirmé par TDR"
              className={inputClass}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">💊 Médicaments</h2>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              + Ajouter une ligne
            </button>
          </div>

          <div className="mt-3 space-y-4">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Ligne {i + 1}</p>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={it.medication_name}
                    onChange={(e) => updateItem(i, { medication_name: e.target.value })}
                    placeholder="Médicament (ex : Artéméther-Luméfantrine 80/480)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={it.dosage}
                    onChange={(e) => updateItem(i, { dosage: e.target.value })}
                    placeholder="Dosage (ex : 1 comprimé)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={it.frequency}
                    onChange={(e) => updateItem(i, { frequency: e.target.value })}
                    placeholder="Fréquence (ex : matin et soir)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={it.duration}
                    onChange={(e) => updateItem(i, { duration: e.target.value })}
                    placeholder="Durée (ex : 3 jours)"
                    className={inputClass}
                  />
                </div>
                <input
                  type="text"
                  value={it.instructions}
                  onChange={(e) => updateItem(i, { instructions: e.target.value })}
                  placeholder="Instructions (ex : à prendre pendant le repas)"
                  className={`mt-3 ${inputClass}`}
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Envoi en cours…' : "📤 Signer et envoyer l'ordonnance à la pharmacie"}
        </button>
        <p className="text-center text-xs text-gray-400">
          Signature électronique qualifiée et validité juridique de l'e-ordonnance : points à
          valider avec un juriste local avant mise en production.
        </p>
      </form>
    </DashboardLayout>
  )
}
