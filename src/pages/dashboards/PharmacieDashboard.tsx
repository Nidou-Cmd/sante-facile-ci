import DashboardLayout from '../../components/DashboardLayout'
import ModuleCardLink from '../../components/ModuleCardLink'
import { useAuth } from '../../contexts/AuthContext'

export default function PharmacieDashboard() {
  const { profile } = useAuth()
  return (
    <DashboardLayout
      title={`Espace Pharmacie${profile?.full_name ? ` — ${profile.full_name}` : ''}`}
      subtitle="Recevez les e-prescriptions, préparez les commandes, déclenchez les livraisons."
    >
      <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
        🤝 <strong>Note partenariat :</strong> les partenariats réels avec les officines doivent
        être négociés séparément. La plateforme est conçue pour brancher facilement chaque
        pharmacie partenaire (compte dédié + vérification par un administrateur).
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCardLink
          to="/pharmacie/commandes"
          icon="📥"
          title="Commandes entrantes"
          description="Les e-prescriptions reçues : préparation, envoi en livraison, suivi jusqu'au patient."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/pharmacie/stock"
          icon="📦"
          title="Gestion de stock"
          description="Suivi basique des médicaments : quantités, prix, ruptures."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/pharmacie/fiche"
          icon="🏪"
          title="Ma fiche officine"
          description="Adresse et position GPS de votre officine, pour être visible des patients proches."
          badge="Disponible"
        />
      </div>
    </DashboardLayout>
  )
}
