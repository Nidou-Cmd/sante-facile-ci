import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import ModuleCardLink from '../../components/ModuleCardLink'
import RoleBadge from '../../components/RoleBadge'
import { supabase } from '../../lib/supabaseClient'
import type { Profile, UserRole } from '../../types/auth'

/**
 * Tableau de bord Administrateur — fonctionnel dès le Module 1 :
 * - liste TOUS les profils (grâce à la policy RLS "profiles_select_admin")
 * - vérifie les comptes professionnels (policy "profiles_update_admin")
 */
export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (loadError) setError(`Erreur de chargement : ${loadError.message}`)
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  const verifyProfile = async (id: string) => {
    setBusyId(id)
    setError(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', id)
    if (updateError) setError(`Vérification impossible : ${updateError.message}`)
    else await loadProfiles()
    setBusyId(null)
  }

  const counts = profiles.reduce<Record<UserRole, number>>(
    (acc, p) => ({ ...acc, [p.role]: acc[p.role] + 1 }),
    { patient: 0, medecin: 0, pharmacie: 0, assureur: 0, admin: 0 },
  )
  const pendingCount = profiles.filter(
    (p) => !p.is_verified && p.role !== 'patient' && p.role !== 'admin',
  ).length

  return (
    <DashboardLayout
      title="Administration"
      subtitle="Gestion des comptes et vérification des professionnels de santé."
    >
      {/* Paramètres système */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCardLink
          to="/admin/parametres"
          icon="⚙️"
          title="Paramètres système"
          description="Numéros d'urgence, seuil fallback, serveur vidéo, commission, textes légaux, mobile money — modifiables sans intervention technique."
          badge="Admin"
        />
      </div>

      {/* Statistiques */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Comptes au total" value={profiles.length} />
        <StatCard label="Patients" value={counts.patient} />
        <StatCard
          label="Professionnels"
          value={counts.medecin + counts.pharmacie + counts.assureur}
        />
        <StatCard label="En attente de vérification" value={pendingCount} highlight />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Liste des profils */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{p.full_name || '—'}</p>
                  <p className="text-xs text-gray-500">{p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={p.role} />
                </td>
                <td className="px-4 py-3 text-gray-600">{p.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(p.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3">
                  {p.is_verified ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      ✓ Vérifié
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      En attente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!p.is_verified && (
                    <button
                      onClick={() => void verifyProfile(p.id)}
                      disabled={busyId === p.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {busyId === p.id ? 'Vérification…' : 'Vérifier'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="px-4 py-6 text-sm text-gray-500">Chargement des profils…</p>}
        {!loading && profiles.length === 0 && !error && (
          <p className="px-4 py-6 text-sm text-gray-500">Aucun profil trouvé.</p>
        )}
      </div>
    </DashboardLayout>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlight ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
