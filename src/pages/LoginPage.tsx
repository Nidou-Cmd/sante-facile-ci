import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import LoadingScreen from '../components/LoadingScreen'
import ProfileErrorScreen from '../components/ProfileErrorScreen'
import { useAuth } from '../contexts/AuthContext'
import { translateAuthError } from '../lib/authErrors'
import { roleHomePath } from '../types/auth'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

export default function LoginPage() {
  const { session, profile, profileError, signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Déjà connecté → redirection déclarative vers son tableau de bord
  // (évite toute course entre la mise à jour de session et la navigation)
  if (session && profile) return <Navigate to={roleHomePath(profile.role)} replace />
  if (session && profileError) return <ProfileErrorScreen />
  if (session) return <LoadingScreen message="Ouverture de votre espace…" />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre e-mail et votre mot de passe.')
      return
    }
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email.trim().toLowerCase(), password)
    setSubmitting(false)
    if (signInError) setError(translateAuthError(signInError.message))
    // Succès : la session arrive via onAuthStateChange → redirection automatique ci-dessus
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-gray-900">Connexion</h2>
        <p className="mt-1 text-sm text-gray-600">Heureux de vous revoir sur Santé Facile.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold text-gray-700">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.ci"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold text-gray-700">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Connexion en cours…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-emerald-700 hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthShell>
  )
}
