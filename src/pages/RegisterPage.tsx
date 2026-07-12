import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import LoadingScreen from '../components/LoadingScreen'
import ProfileErrorScreen from '../components/ProfileErrorScreen'
import { useAuth } from '../contexts/AuthContext'
import { translateAuthError } from '../lib/authErrors'
import { roleHomePath, SIGNUP_ROLE_OPTIONS, type SignUpRole } from '../types/auth'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

export default function RegisterPage() {
  const { session, profile, profileError, signUp } = useAuth()

  const [role, setRole] = useState<SignUpRole>('patient')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  const selectedOption = SIGNUP_ROLE_OPTIONS.find((option) => option.value === role)!

  // Déjà connecté → redirection déclarative vers son tableau de bord
  if (session && profile) return <Navigate to={roleHomePath(profile.role)} replace />
  if (session && profileError) return <ProfileErrorScreen />
  if (session) return <LoadingScreen message="Création de votre espace…" />

  // Écran "vérifiez votre boîte mail" (si la confirmation d'e-mail est activée sur Supabase)
  if (confirmationEmail) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">📬</div>
          <h2 className="mt-4 text-xl font-extrabold text-gray-900">Vérifiez votre boîte mail</h2>
          <p className="mt-2 text-sm text-gray-600">
            Un e-mail de confirmation a été envoyé à <strong>{confirmationEmail}</strong>. Cliquez
            sur le lien reçu pour activer votre compte, puis connectez-vous.
          </p>
          <Link
            to="/connexion"
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Aller à la connexion
          </Link>
        </div>
      </AuthShell>
    )
  }

  const validate = (): string | null => {
    if (!fullName.trim()) return `Veuillez renseigner le champ « ${selectedOption.nameLabel} ».`
    if (phone.replace(/\D/g, '').length < 8)
      return 'Veuillez renseigner un numéro de téléphone valide (ex : +225 07 00 00 00 00).'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'Veuillez renseigner une adresse e-mail valide.'
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
    if (password !== confirm) return 'Les deux mots de passe ne correspondent pas.'
    if (!acceptTerms)
      return 'Veuillez accepter les Conditions générales et la Politique de confidentialité.'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(true)
    const { error: signUpError, needsEmailConfirmation } = await signUp({
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim(),
      role,
      acceptedTermsAt: new Date().toISOString(),
    })
    setSubmitting(false)
    if (signUpError) {
      setError(translateAuthError(signUpError.message))
      return
    }
    if (needsEmailConfirmation) setConfirmationEmail(email.trim().toLowerCase())
    // Sinon : session créée immédiatement → redirection automatique ci-dessus
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-gray-900">Créer un compte</h2>
        <p className="mt-1 text-sm text-gray-600">Choisissez votre profil pour commencer.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Choix du rôle */}
        <div className="grid grid-cols-2 gap-3">
          {SIGNUP_ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRole(option.value)}
              className={`rounded-xl border p-3 text-left transition ${
                role === option.value
                  ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{option.icon}</span>
              <p className="mt-1 text-sm font-bold text-gray-900">{option.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">{option.description}</p>
            </button>
          ))}
        </div>

        {selectedOption.needsVerification && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ℹ️ Les comptes professionnels ({selectedOption.label}) sont soumis à une vérification
            par un administrateur avant activation complète.
          </p>
        )}

        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-semibold text-gray-700">
            {selectedOption.nameLabel}
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={selectedOption.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-gray-700">
            Téléphone
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 07 00 00 00 00"
            className={inputClass}
          />
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-gray-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-semibold text-gray-700">
              Confirmation
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Répétez le mot de passe"
              className={inputClass}
            />
          </div>
        </div>

        {/* P0 Confiance — consentement explicite (horodaté côté base) */}
        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            J'accepte les{' '}
            <Link to="/cgu" target="_blank" className="font-semibold text-emerald-700 underline">
              Conditions générales d'utilisation
            </Link>{' '}
            et la{' '}
            <Link to="/confidentialite" target="_blank" className="font-semibold text-emerald-700 underline">
              Politique de confidentialité
            </Link>{' '}
            (données de santé).
          </span>
        </label>

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
          {submitting ? 'Création du compte…' : 'Créer mon compte'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà inscrit ?{' '}
        <Link to="/connexion" className="font-semibold text-emerald-700 hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthShell>
  )
}
