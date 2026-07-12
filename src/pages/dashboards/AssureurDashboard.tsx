import DashboardLayout from '../../components/DashboardLayout'
import ModuleCardLink from '../../components/ModuleCardLink'
import { useAuth } from '../../contexts/AuthContext'

export default function AssureurDashboard() {
  const { profile } = useAuth()
  return (
    <DashboardLayout
      title={`Espace Assureur${profile?.full_name ? ` — ${profile.full_name}` : ''}`}
      subtitle="Vérifiez l'éligibilité, validez les prises en charge, suivez les remboursements."
    >
      <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
        🤝 <strong>Note partenariat :</strong> les partenariats réels avec les compagnies
        d'assurance et mutuelles doivent être négociés séparément. Modèle de revenu (exemple à
        valider) : commission par transaction validée ou abonnement partenaire — voir
        src/lib/config.ts.
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCardLink
          to="/assureur/polices"
          icon="✅"
          title="Polices & éligibilité"
          description="Recherchez un patient par e-mail, vérifiez son éligibilité, enregistrez sa police."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/assureur/demandes"
          icon="🧾"
          title="Prises en charge"
          description="Validez les demandes (totale/partielle/refus) et suivez l'historique des remboursements."
          badge="Disponible"
        />
      </div>
    </DashboardLayout>
  )
}
