import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../lib/settings'
import { Link } from 'react-router-dom'
import ChatbotWidget from './ChatbotWidget'
import Logo from './Logo'
import NotificationBell from './NotificationBell'
import RoleBadge from './RoleBadge'

interface DashboardLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

export default function DashboardLayout({ title, subtitle, children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth()
  const { settings } = useSettings()

  // P1 — État de connexion (contexte 3G/coupures) : bannière hors-ligne
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const showVerificationBanner =
    profile !== null && profile.role !== 'patient' && profile.role !== 'admin' && !profile.is_verified

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          {profile && (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {profile.full_name || profile.email}
                </p>
                <RoleBadge role={profile.role} />
              </div>
              <button
                onClick={() => void signOut()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      {!isOnline && (
        <div className="border-b border-red-200 bg-red-50">
          <div className="mx-auto max-w-6xl px-4 py-2 text-sm font-semibold text-red-800 sm:px-6">
            📡 Hors ligne — vérifiez votre connexion. Les actions seront disponibles dès le retour
            du réseau.
          </div>
        </div>
      )}

      {showVerificationBanner && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-6xl px-4 py-3 text-sm text-amber-800 sm:px-6">
            ⏳ <strong>Compte en attente de vérification.</strong> Un administrateur Santé Facile
            doit valider votre compte professionnel avant l'accès complet aux fonctionnalités.
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-8 text-xs text-gray-400 sm:px-6">
        <span>Santé Facile · Côte d'Ivoire 🇨🇮</span>
        <Link to="/mentions-legales" className="hover:text-gray-600 hover:underline">Mentions légales</Link>
        <Link to="/confidentialite" className="hover:text-gray-600 hover:underline">Confidentialité</Link>
        <Link to="/cgu" className="hover:text-gray-600 hover:underline">CGU</Link>
        <span>
          Urgence vitale : SAMU {settings.emergencyNumbers.samu} · Pompiers{' '}
          {settings.emergencyNumbers.pompiers}
        </span>
      </footer>

      {/* Module 10 — Assistant d'aide (réponses pré-définies, FR) */}
      <ChatbotWidget />
    </div>
  )
}
