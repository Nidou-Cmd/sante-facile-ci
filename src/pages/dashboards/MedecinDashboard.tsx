import DashboardLayout from '../../components/DashboardLayout'
import ModuleCardLink from '../../components/ModuleCardLink'
import { useAuth } from '../../contexts/AuthContext'

export default function MedecinDashboard() {
  const { profile } = useAuth()
  return (
    <DashboardLayout
      title={`Espace Médecin${profile?.full_name ? ` — ${profile.full_name}` : ''}`}
      subtitle="Consultez à distance, prescrivez en ligne — concentrez-vous sur vos patients."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCardLink
          to="/medecin/agenda"
          icon="📅"
          title="Agenda & file d'urgence"
          description="Vos rendez-vous, votre disponibilité et les urgences en attente de prise en charge."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/medecin/prescriptions"
          icon="📝"
          title="e-Prescriptions"
          description="Rédigez des ordonnances envoyées automatiquement à la pharmacie du patient."
          badge="Disponible"
        />
        <ModuleCardLink
          to="/messages"
          icon="💬"
          title="Messagerie patients"
          description="Échangez avec vos patients et consultez leurs documents médicaux."
          badge="Disponible"
        />
      </div>
      <p className="mt-6 text-xs text-gray-400">
        🎥 Les consultations vidéo se lancent depuis l'agenda (bouton « Consulter » sur un
        rendez-vous confirmé) ou en prenant en charge une urgence.
      </p>
    </DashboardLayout>
  )
}
