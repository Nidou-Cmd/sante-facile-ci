import DashboardLayout from '../../components/DashboardLayout'
import ModuleCardLink from '../../components/ModuleCardLink'
import OnboardingTour from '../../components/OnboardingTour'
import { useAuth } from '../../contexts/AuthContext'

export default function PatientDashboard() {
  const { profile } = useAuth()
  return (
    <DashboardLayout
      title={`Bonjour${profile?.full_name ? ` ${profile.full_name}` : ''} 👋`}
      subtitle="Le médecin et la pharmacie viennent à vous — plus jamais de salle d'attente."
    >
      {/* P1 — Tutoriel premier usage (mémorisé, jamais bloquant) */}
      <OnboardingTour />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCardLink
          to="/patient/rendez-vous"
          icon="📅"
          title="Rendez-vous & Urgence"
          description="Réservez une téléconsultation, ou utilisez le bouton Urgence pour une prise en charge immédiate."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/patient/profil"
          icon="📍"
          title="Mon profil & ma pharmacie"
          description="Votre adresse, votre position GPS et votre pharmacie préférée calculée par proximité."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/patient/ordonnances"
          icon="📄"
          title="Mes ordonnances"
          description="Vos prescriptions électroniques, impression PDF et demandes de prise en charge assurance."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/patient/livraisons"
          icon="🛵"
          title="Suivi de livraison"
          description="Vos médicaments suivis en temps réel : préparation → en route → livré."
          badge="Temps réel"
        />
        <ModuleCardLink
          to="/messages"
          icon="💬"
          title="Messagerie médicale"
          description="Échangez en toute sécurité avec vos médecins et partagez vos documents."
          badge="Disponible"
        />
      </div>
    </DashboardLayout>
  )
}
