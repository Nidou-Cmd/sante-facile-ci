import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { APPOINTMENT_STATUS, formatDateTime } from '../../lib/labels'
import { supabase } from '../../lib/supabaseClient'
import type { Appointment } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/** Module 3 (côté médecin) — Agenda + file d'urgence prioritaire. */
export default function AgendaPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const [speciality, setSpeciality] = useState('Médecine générale')
  const [availableNow, setAvailableNow] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [emergencies, setEmergencies] = useState<Appointment[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const [profRes, urgRes, apptRes] = await Promise.all([
      supabase.from('medecin_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('appointments')
        .select('*')
        .eq('is_emergency', true)
        .is('medecin_id', null)
        .eq('status', 'en_attente')
        .order('created_at', { ascending: true }),
      supabase
        .from('appointments')
        .select('*')
        .eq('medecin_id', userId)
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .limit(30),
    ])
    if (profRes.data) {
      setSpeciality(profRes.data.speciality)
      setAvailableNow(profRes.data.is_available_now)
    }
    if (urgRes.error) setError(urgRes.error.message)
    setEmergencies(urgRes.data ?? [])
    setAppointments(apptRes.data ?? [])
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  // File d'urgence en temps réel
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`urgences-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load])

  const saveMedProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    const { error: upsertError } = await supabase.from('medecin_profiles').upsert({
      id: userId,
      speciality: speciality.trim() || 'Médecine générale',
      is_available_now: availableNow,
    })
    if (upsertError) setError(`Profil : ${upsertError.message}`)
    setSavingProfile(false)
  }

  /** Prendre en charge une urgence : premier arrivé, premier servi (filtre anti-course). */
  const claimEmergency = async (a: Appointment) => {
    if (!userId) return
    setBusyId(a.id)
    setError(null)
    const { data, error: claimError } = await supabase
      .from('appointments')
      .update({
        medecin_id: userId,
        medecin_name: profile?.full_name ?? '',
        status: 'confirme',
        scheduled_at: new Date().toISOString(),
      })
      .eq('id', a.id)
      .is('medecin_id', null)
      .select('id')
    setBusyId(null)
    if (claimError) {
      setError(`Prise en charge impossible : ${claimError.message}`)
      return
    }
    if (!data || data.length === 0) {
      setError('Cette urgence vient d’être prise par un autre médecin.')
      void load()
      return
    }
    navigate(`/consultation/${a.id}`)
  }

  const setStatus = async (id: string, status: Appointment['status']) => {
    setBusyId(id)
    const { error: updError } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (updError) setError(updError.message)
    else await load()
    setBusyId(null)
  }

  return (
    <DashboardLayout
      title="Agenda & file d'urgence"
      subtitle="Vos rendez-vous et les urgences en attente de prise en charge."
    >
      <Link to="/medecin" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Disponibilité */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="speciality" className="mb-1 block text-sm font-semibold text-gray-700">
              Spécialité
            </label>
            <input
              id="speciality"
              type="text"
              value={speciality}
              onChange={(e) => setSpeciality(e.target.value)}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={availableNow}
              onChange={(e) => setAvailableNow(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            🟢 Disponible maintenant (urgences)
          </label>
          <button
            onClick={() => void saveMedProfile()}
            disabled={savingProfile}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* File d'urgence */}
      <div className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 p-5">
        <h2 className="font-bold text-red-800">🚨 File d'urgence ({emergencies.length})</h2>
        {emergencies.length === 0 ? (
          <p className="mt-2 text-sm text-red-700/70">Aucune urgence en attente.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {emergencies.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-900">{a.patient_name || 'Patient'}</p>
                  <p className="text-xs text-gray-500">
                    Demandé à {formatDateTime(a.created_at)}
                    {a.reason && ` · ${a.reason}`}
                  </p>
                </div>
                <button
                  onClick={() => void claimEmergency(a)}
                  disabled={busyId === a.id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {busyId === a.id ? 'Prise en charge…' : '⚡ Prendre en charge'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Agenda */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-gray-900">🗓️ Mes rendez-vous</h2>
        {appointments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Aucun rendez-vous pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {a.is_emergency ? '🚨 ' : ''}
                    {a.patient_name || 'Patient'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(a.scheduled_at)}
                    {a.reason && ` · ${a.reason}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge {...APPOINTMENT_STATUS[a.status]} />
                  {a.status === 'en_attente' && (
                    <button
                      onClick={() => void setStatus(a.id, 'confirme')}
                      disabled={busyId === a.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Confirmer
                    </button>
                  )}
                  {a.status === 'confirme' && (
                    <>
                      <Link
                        to={`/consultation/${a.id}`}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        🎥 Consulter
                      </Link>
                      <button
                        onClick={() => void setStatus(a.id, 'termine')}
                        disabled={busyId === a.id}
                        className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                      >
                        Terminer
                      </button>
                    </>
                  )}
                  {a.status === 'termine' && (
                    <Link
                      to={`/medecin/prescriptions/nouvelle?patient=${a.patient_id}&nom=${encodeURIComponent(a.patient_name)}&rdv=${a.id}`}
                      className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      📝 Prescrire
                    </Link>
                  )}
                  {(a.status === 'en_attente' || a.status === 'confirme') && (
                    <button
                      onClick={() => void setStatus(a.id, 'annule')}
                      disabled={busyId === a.id}
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
      </div>
    </DashboardLayout>
  )
}
