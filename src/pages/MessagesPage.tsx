import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTime } from '../lib/labels'
import { supabase } from '../lib/supabaseClient'
import type { ChatMessage, Conversation, VerifiedDoctor } from '../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

const MAX_FILE_MB = 10

/**
 * Module 9 — Messagerie sécurisée patient ↔ médecin + documents
 * médicaux (Supabase Storage, bucket privé + RLS participants).
 */
export default function MessagesPage() {
  const { user, profile } = useAuth()
  const userId = user?.id ?? null
  const isPatient = profile?.role === 'patient'

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [doctors, setDoctors] = useState<VerifiedDoctor[]>([])
  const [newDoctorId, setNewDoctorId] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const active = conversations.find((c) => c.id === activeId) ?? null

  const loadConversations = useCallback(async () => {
    if (!userId) return
    const { data, error: loadError } = await supabase
      .from('conversations')
      .select('*')
      .or(`patient_id.eq.${userId},medecin_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
    if (loadError) setError(loadError.message)
    setConversations(data ?? [])
    if (data && data.length > 0) {
      setActiveId((prev) => prev ?? data[0].id)
    }
  }, [userId])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  // Liste des médecins (pour démarrer une conversation côté patient)
  useEffect(() => {
    if (!isPatient) return
    void (async () => {
      const { data } = await supabase.rpc('list_verified_doctors')
      setDoctors(data ?? [])
    })()
  }, [isPatient])

  const loadMessages = useCallback(async () => {
    if (!activeId) return
    const { data, error: loadError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .limit(200)
    if (loadError) setError(loadError.message)
    setMessages(data ?? [])
  }, [activeId])

  useEffect(() => {
    setMessages([])
    void loadMessages()
  }, [loadMessages])

  // 🔴 Messages en temps réel sur la conversation active
  useEffect(() => {
    if (!activeId) return
    const channel = supabase
      .channel(`messages-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as ChatMessage).id)
              ? prev
              : [...prev, payload.new as ChatMessage],
          )
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startConversation = async () => {
    if (!userId || !newDoctorId) return
    const doctor = doctors.find((d) => d.id === newDoctorId)
    if (!doctor) return
    setError(null)
    const { data, error: upsertError } = await supabase
      .from('conversations')
      .upsert(
        {
          patient_id: userId,
          medecin_id: doctor.id,
          patient_name: profile?.full_name ?? '',
          medecin_name: doctor.full_name,
        },
        { onConflict: 'patient_id,medecin_id' },
      )
      .select()
      .single()
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    setNewDoctorId('')
    await loadConversations()
    if (data) setActiveId(data.id)
  }

  const sendText = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId || !activeId || !input.trim()) return
    setSending(true)
    setError(null)
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: activeId,
      sender_id: userId,
      content: input.trim(),
    })
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setInput('')
  }

  const sendFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId || !activeId) return
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_FILE_MB} Mo).`)
      return
    }
    setUploading(true)
    setError(null)
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${userId}/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('medical-documents')
      .upload(path, file, { upsert: false })
    if (uploadError) {
      setError(`Envoi du document impossible : ${uploadError.message}`)
      setUploading(false)
      return
    }
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: activeId,
      sender_id: userId,
      content: '',
      file_path: path,
      file_name: file.name,
    })
    setUploading(false)
    if (msgError) setError(msgError.message)
  }

  const openDocument = async (message: ChatMessage) => {
    if (!message.file_path) return
    const { data, error: signError } = await supabase.storage
      .from('medical-documents')
      .createSignedUrl(message.file_path, 3600)
    if (signError || !data) {
      setError(`Ouverture impossible : ${signError?.message ?? 'erreur inconnue'}`)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const backLink = isPatient ? '/patient' : '/medecin'
  const peerName = (c: Conversation) => (isPatient ? `Dr ${c.medecin_name || '—'}` : c.patient_name || 'Patient')

  return (
    <DashboardLayout
      title="Messagerie médicale"
      subtitle="Échanges sécurisés et partage de documents (ordonnances, résultats d'analyses…)."
    >
      <Link to={backLink} className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
        {/* -------- Conversations -------- */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">Conversations</h2>

          {isPatient && (
            <div className="mt-3 flex gap-2">
              <select value={newDoctorId} onChange={(e) => setNewDoctorId(e.target.value)} className={inputClass}>
                <option value="">— Nouveau : choisir un médecin vérifié —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    ✓ {d.full_name} · {d.speciality}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void startConversation()}
                disabled={!newDoctorId}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                +
              </button>
            </div>
          )}

          <ul className="mt-3 space-y-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    c.id === activeId ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {peerName(c)}
                </button>
              </li>
            ))}
          </ul>
          {conversations.length === 0 && (
            <p className="mt-3 text-xs text-gray-500">
              {isPatient
                ? 'Aucune conversation — choisissez un médecin ci-dessus pour commencer.'
                : 'Aucune conversation — vos patients peuvent vous écrire depuis leur espace.'}
            </p>
          )}
        </div>

        {/* -------- Fil de messages -------- */}
        <div className="flex h-[32rem] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="font-bold text-gray-900">{peerName(active)}</p>
                <p className="text-[11px] text-gray-400">
                  🔒 Chiffré en transit · documents stockés dans un espace privé (accès participants uniquement)
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.sender_id === userId
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {m.file_path ? (
                          <button
                            onClick={() => void openDocument(m)}
                            className={`flex items-center gap-2 font-semibold underline ${
                              mine ? 'text-white' : 'text-emerald-700'
                            }`}
                          >
                            📎 {m.file_name ?? 'Document'}
                          </button>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                        <p className={`mt-1 text-[10px] ${mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                          {formatDateTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={sendText} className="flex items-center gap-2 border-t border-gray-100 p-3">
                <label
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-gray-300 text-lg transition hover:bg-gray-50 ${
                    uploading ? 'animate-pulse opacity-60' : ''
                  }`}
                  title="Joindre un document (max 10 Mo)"
                >
                  📎
                  <input type="file" className="hidden" onChange={(e) => void sendFile(e)} disabled={uploading} />
                </label>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Votre message…"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  ➤
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
