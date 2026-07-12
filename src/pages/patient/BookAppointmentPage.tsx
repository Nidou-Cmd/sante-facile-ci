import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { APPOINTMENT_STATUS, formatDateTime } from '../../lib/labels'
import { useSettings } from '../../lib/settings'
import { supabase } from '../../lib/supabaseClient'
import type { Appointment, VerifiedDoctor } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/** Module 3 — Réservation de rendez-vous + bouton Urgence (file de priorité). */
export default function BookAppointmentPage() {
  const { user, profile } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const [doctors, setDoctors] = useState<VerifiedDoctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [emergencySubmitting, setEmergencySubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadAll = useCallback(async () => {
    if (!userId) return
    const [docsRes, apptsRes] = await Promise.all([
      supabase.rpc('list_verified_doctors'),
      supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (docsRes.error) setMessage({ type: 'error', text: `Médecins : ${docsRes.error.message}` })
    else setDoctors(docsRes.data ?? [])
    if (apptsRes.error) setMessage({ type: 'error', text: `Rendez-vous : ${apptsRes.error.message}` })
    else setAppointments(apptsRes.data ?? [])
  }, [userId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleBook = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const doctor = doctors.find((d) => d.id === doctorId)
    if (!doctor) {
      setMessage({ type: 'error', text: 'Veuillez choisir un médecin.' })
      return
    }
    if (!dateTime || new Date(dateTime).getTime() < Date.now()) {
      setMessage({ type: 'error', text: 'Veuillez choisir une date et une heure à venir.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    const { error } = await supabase.from('appointments').insert({
      patient_id: userId,
      medecin_id: doctor.id,
      patient_name: profile?.full_name ?? '',
      medecin_name: doctor.full_name,
      scheduled_at: new Date(dateTime).toISOString(),
      reason: reason.trim(),
    })
    setSubmitting(false)
    if (error) {
      setMessage({ type: 'error', text: `Réservation impossible : ${error.message}` })
      return
    }
    setMessage({ type: 'success', text: 'Demande envoyée — le médecin doit confirmer le créneau ✔' })
    setDateTime('')
    setReason('')
    void loadAll()
  }

  const handleEmergency = async () => {
    if (!userId) return
    setEmergencySubmitting(true)
    setMessage(null)
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: userId,
        patient_name: profile?.full_name ?? '',
        is_emergency: true,
        reason: reason.trim() || 'Urgence médicale',
      })
      .select('id')
      .single()
    setEmergencySubmitting(false)
    if (error) {
      setMessage({ type: 'error', text: `Urgence impossible : ${error.message}` })
      return
    }
    setMessage({
      type: 'success',
      text: '🚨 Urgence envoyée à tous les médecins disponibles — le premier qui accepte vous prend en charge.',
    })
    if (data) navigate(`/consultation/${data.id}`)
  }

  const cancelAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'annule' }).eq('id', id)
    if (error) setMessage({ type: 'error', text: `Annulation impossible : ${error.message}` })
    else void loadAll()
  }

  const minDateTime = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <DashboardLayout
      title="Rendez-vous & Urgence"
      subtitle="Réservez une téléconsultation, ou utilisez le bouton Urgence pour une prise en charge immédiate."
    >
      <Link to="/patient" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* ---------- Réservation ---------- */}
        <form onSubmit={handleBook} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" noValidate>
          <h2 className="font-bold text-gray-900">📅 Réserver une téléconsultation</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="doctor" className="mb-1 block text-sm font-semibold text-gray-700">
                Médecin
              </label>
              <select id="doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
                <option value="">— Choisir un médecin vérifié —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    ✓ {d.full_name} · {d.speciality}
                    {d.is_available_now ? ' · 🟢 disponible' : ''}
                  </option>
                ))}
              </select>
              {doctors.length > 0 && (
                <p className="mt-1 text-xs text-emerald-700">
                  ✓ Tous les médecins proposés sont vérifiés par l'équipe Santé Facile.
                </p>
              )}
              {doctors.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Aucun médecin vérifié pour le moment (l'admin doit vérifier au moins un compte médecin).
                </p>
              )}
            </div>

            <div>
              <label htmlFor="dateTime" className="mb-1 block text-sm font-semibold text-gray-700">
                Date et heure souhaitées
              </label>
              <input
                id="dateTime"
                type="datetime-local"
                min={minDateTime}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="reason" className="mb-1 block text-sm font-semibold text-gray-700">
                Motif (visible par le médecin)
              </label>
              <textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex : fièvre depuis 2 jours, maux de tête…"
                className={inputClass}
              />
            </div>

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
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Envoi…' : 'Demander ce créneau'}
            </button>
          </div>

          {/* ---------- Urgence ---------- */}
          <div className="mt-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-800">🚨 Besoin d'un médecin immédiatement ?</p>
            <p className="mt-1 text-xs text-red-700">
              Votre demande passe en <strong>file de priorité</strong> devant tous les médecins
              disponibles. En cas d'urgence vitale, appelez d'abord les secours :{' '}
              <a href={`tel:${settings.emergencyNumbers.samu}`} className="font-bold underline">
                SAMU {settings.emergencyNumbers.samu}
              </a>{' '}
              ·{' '}
              <a href={`tel:${settings.emergencyNumbers.pompiers}`} className="font-bold underline">
                Pompiers {settings.emergencyNumbers.pompiers}
              </a>{' '}
              (appels courts gratuits).
            </p>
            <button
              type="button"
              onClick={() => void handleEmergency()}
              disabled={emergencySubmitting}
              className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {emergencySubmitting ? 'Envoi de l’urgence…' : '🚨 URGENCE — Trouver un médecin maintenant'}
            </button>
          </div>
        </form>

        {/* ---------- Mes rendez-vous ---------- */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900">🗓️ Mes demandes & rendez-vous</h2>
          {appointments.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Aucun rendez-vous pour le moment.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {appointments.map((a) => (
                <li key={a.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">
                      {a.is_emergency ? '🚨 Urgence' : `Dr ${a.medecin_name || '—'}`}
                    </p>
                    <StatusBadge {...APPOINTMENT_STATUS[a.status]} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {a.is_emergency && !a.medecin_id
                      ? 'En attente de prise en charge par un médecin…'
                      : formatDateTime(a.scheduled_at)}
                    {a.reason && ` · ${a.reason}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status === 'confirme' && (
                      <Link
                        to={`/consultation/${a.id}`}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        🎥 Rejoindre la consultation
                      </Link>
                    )}
                    {a.is_emergency && a.status === 'en_attente' && (
                      <Link
                        to={`/consultation/${a.id}`}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                      >
                        Suivre l'urgence
                      </Link>
                    )}
                    {(a.status === 'en_attente' || a.status === 'confirme') && (
                      <button
                        onClick={() => void cancelAppointment(a.id)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
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
      </div>
    </DashboardLayout>
  )
}
