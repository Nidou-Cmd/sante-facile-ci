import { useAuth } from '../contexts/AuthContext'

export default function ProfileErrorScreen() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-4 text-lg font-bold text-gray-900">Profil introuvable</h1>
        <p className="mt-2 text-sm text-gray-600">
          Votre compte existe mais son profil n'a pas pu être chargé. Vérifiez que le script SQL du
          Module 1 (<code className="rounded bg-gray-100 px-1">001_auth_multi_roles.sql</code>) a
          bien été exécuté dans Supabase, puis réessayez.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Réessayer
          </button>
          <button
            onClick={() => void signOut()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
