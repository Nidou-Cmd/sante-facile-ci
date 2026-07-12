import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { JITSI_ROOM_PREFIX } from '../lib/config'
import { useSettings } from '../lib/settings'
import { APPOINTMENT_STATUS, formatDateTime } from '../lib/labels'
import { supabase } from '../lib/supabaseClient'
import type { Appointment } from '../lib/database.types'

/**
 * Module 4 — Vidéoconsultation Jitsi Meet (embed gratuit).
 * Accessible au patient concerné et au médecin assigné.
 * Pour une urgence en attente, le patient voit la salle s'ouvrir
 * EN DIRECT dès qu'un médecin prend en charge (Realtime).
 */
export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  // P0 : consentement explicite avant d'ouvrir la salle vidéo
  const [videoAccepted, setVideoAccepted] = useState(false)
  // P0 : chronomètre d'attente pour le fallback urgence
  const [elapsedSec, setElapsedSec] = useState(0)

  const load = useCallback(async () => {
    if (!id) return
    const { data, error: loadError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (loadError) setError(loadError.message)
    setAppointment(data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Suivi en direct du rendez-vous (prise en charge d'urgence, changement de statut)
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`appointment-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${id}` },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id, load])

  // P0 — Fallback urgence : chronomètre tant que l'urgence n'est pas prise
  useEffect(() => {
    if (!appointment || appointment.status !== 'en_attente') return
    const startedAt = new Date(appointment.created_at).getTime()
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [appointment])

  const endConsultation = async () => {
    if (!appointment) return
    setEnding(true)
    const { error: updError } = await supabase
      .from('appointments')
      .update({ status: 'termine' })
      .eq('id', appointment.id)
    setEnding(false)
    if (updError) {
      setError(updError.message)
      return
    }
    navigate(
      `/medecin/prescriptions/nouvelle?patient=${appointment.patient_id}&nom=${encodeURIComponent(appointment.patient_name)}&rdv=${appointment.id}`,
    )
  }

  const isMedecin = profile?.role === 'medecin'
  const backLink = isMedecin ? '/medecin/agenda' : '/patient/rendez-vous'
  const isParticipant =
    appointment && userId && (appointment.patient_id === userId || appointment.medecin_id === userId)
  const roomName = appointment ? `${JITSI_ROOM_PREFIX}-${appointment.room_code}` : ''
  const displayName = profile?.full_name || 'Utilisateur Santé Facile'
  const jitsiUrl = `${settings.jitsiBaseUrl}/${roomName}#userInfo.displayName=%22${encodeURIComponent(displayName)}%22&config.prejoinConfig.enabled=false`

  return (
    <DashboardLayout title="Consultation vidéo" subtitle="Téléconsultation sécurisée via Jitsi Meet.">
      <Link to={backLink} className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour
      </Link>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Chargement…</p>
      ) : error ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : !appointment || !isParticipant ? (
        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          Consultation introuvable ou accès non autorisé.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <p className="font-bold text-gray-900">
                {appointment.is_emergency ? '🚨 Urgence — ' : ''}
                {isMedecin ? appointment.patient_name || 'Patient' : `Dr ${appointment.medecin_name || '—'}`}
              </p>
              <p className="text-xs text-gray-500">
                {formatDateTime(appointment.scheduled_at)}
                {appointment.reason && ` · ${appointment.reason}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge {...APPOINTMENT_STATUS[appointment.status]} />
              {isMedecin && appointment.status === 'confirme' && (
                <button
                  onClick={() => void endConsultation()}
                  disabled={ending}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {ending ? '…' : '✅ Terminer & prescrire'}
                </button>
              )}
            </div>
          </div>

          {appointment.status === 'confirme' ? (
            videoAccepted ? (
              <>
                <iframe
                  title="Consultation vidéo Santé Facile"
                  src={jitsiUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="h-[70vh] w-full rounded-2xl border border-gray-200 bg-black shadow-sm"
                />
                <p className="text-xs text-gray-400">
                  🎥 Salle privée : {roomName} · Autorisez caméra et micro dans votre navigateur.
                </p>
              </>
            ) : (
              /* P0 — Consentement explicite avant d'ouvrir la vidéo (et chargement différé) */
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div className="text-3xl">🎥</div>
                <h2 className="mt-3 font-bold text-gray-900">Rejoindre la consultation vidéo</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                  La vidéo transite par le serveur {new URL(settings.jitsiBaseUrl).hostname} dans une
                  salle privée à identifiant unique. En rejoignant, vous consentez à ce traitement
                  (voir{' '}
                  <Link to="/confidentialite" target="_blank" className="font-semibold text-emerald-700 underline">
                    Politique de confidentialité
                  </Link>
                  ). Autorisez ensuite caméra et micro.
                </p>
                <button
                  onClick={() => setVideoAccepted(true)}
                  className="mt-5 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  ✅ J'ai compris — Rejoindre la salle
                </button>
              </div>
            )
          ) : appointment.status === 'en_attente' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                <div className="text-3xl">{appointment.is_emergency ? '🚨' : '⏳'}</div>
                <p className="mt-2 font-semibold text-amber-900">
                  {appointment.is_emergency
                    ? 'Recherche d’un médecin disponible… Cette page s’actualisera automatiquement dès qu’un médecin vous prend en charge.'
                    : 'En attente de confirmation du médecin. La salle vidéo s’ouvrira ici une fois le rendez-vous confirmé.'}
                </p>
                {appointment.is_emergency && (
                  <p className="mt-2 text-sm text-amber-700">
                    ⏱ Temps d'attente : {Math.floor(elapsedSec / 60)} min {elapsedSec % 60} s
                  </p>
                )}
              </div>

              {/* P0 — Fallback : au-delà du délai, mettre les secours en avant */}
              {appointment.is_emergency && elapsedSec >= settings.emergencyFallbackSeconds && (
                <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-center">
                  <p className="font-bold text-red-800">
                    ⚠️ Aucun médecin n'a encore accepté votre urgence.
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    N'attendez pas si votre état est grave : appelez immédiatement les secours
                    (appels courts et gratuits en Côte d'Ivoire).
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <a
                      href={`tel:${settings.emergencyNumbers.samu}`}
                      className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      📞 SAMU {settings.emergencyNumbers.samu}
                    </a>
                    <a
                      href={`tel:${settings.emergencyNumbers.pompiers}`}
                      className="rounded-lg border border-red-400 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                      🚒 Pompiers {settings.emergencyNumbers.pompiers}
                    </a>
                  </div>
                  <p className="mt-3 text-xs text-red-600">
                    Votre demande reste active : si un médecin l'accepte, cette page s'ouvrira
                    automatiquement sur la salle vidéo.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
              {appointment.status === 'termine'
                ? '✅ Cette consultation est terminée. Votre ordonnance éventuelle apparaîtra dans « Mes ordonnances ».'
                : 'Cette consultation a été annulée.'}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
