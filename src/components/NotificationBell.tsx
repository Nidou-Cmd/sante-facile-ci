import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTime } from '../lib/labels'
import { supabase } from '../lib/supabaseClient'
import type { SanteNotification } from '../lib/database.types'

/**
 * P0 — Cloche de notifications in-app (4 moments clés + messagerie),
 * alimentée par les triggers SQL et mise à jour en temps réel.
 */
export default function NotificationBell() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<SanteNotification[]>([])
  const panelRef = useRef<HTMLDivElement | null>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('sante_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
    setNotifications(data ?? [])
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  // Temps réel : nouvelle notification → rafraîchir
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sante_notifications', filter: `user_id=eq.${userId}` },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load])

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const openPanel = async () => {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0 && userId) {
      // Marquer comme lues à l'ouverture
      await supabase
        .from('sante_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => void openPanel()}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} non lues)` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg transition hover:bg-gray-100"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <p className="border-b border-gray-100 px-4 py-2.5 text-sm font-bold text-gray-900">Notifications</p>
          <ul className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">Aucune notification.</li>
            )}
            {notifications.map((n) => (
              <li key={n.id} className="border-b border-gray-50 last:border-0">
                {n.link_path ? (
                  <Link
                    to={n.link_path}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition hover:bg-emerald-50/60"
                  >
                    <NotifContent n={n} />
                  </Link>
                ) : (
                  <div className="px-4 py-3">
                    <NotifContent n={n} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NotifContent({ n }: { n: SanteNotification }) {
  return (
    <>
      <p className="text-sm font-semibold text-gray-900">{n.title}</p>
      {n.body && <p className="mt-0.5 text-xs text-gray-600">{n.body}</p>}
      <p className="mt-1 text-[10px] text-gray-400">{formatDateTime(n.created_at)}</p>
    </>
  )
}
