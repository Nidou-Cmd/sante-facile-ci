import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoadingScreen from './components/LoadingScreen'
import ProfileErrorScreen from './components/ProfileErrorScreen'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './lib/settings'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { roleHomePath, type UserRole } from './types/auth'

// P1 Performance — chargement différé des pages secondaires
// (réduit le bundle initial pour les connexions 3G/appareils modestes)
const PatientDashboard = lazy(() => import('./pages/dashboards/PatientDashboard'))
const MedecinDashboard = lazy(() => import('./pages/dashboards/MedecinDashboard'))
const PharmacieDashboard = lazy(() => import('./pages/dashboards/PharmacieDashboard'))
const AssureurDashboard = lazy(() => import('./pages/dashboards/AssureurDashboard'))
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'))
const AdminSettingsPage = lazy(() => import('./pages/admin/SettingsPage'))
const PatientProfilePage = lazy(() => import('./pages/patient/PatientProfilePage'))
const BookAppointmentPage = lazy(() => import('./pages/patient/BookAppointmentPage'))
const OrdonnancesPage = lazy(() => import('./pages/patient/OrdonnancesPage'))
const LivraisonsPage = lazy(() => import('./pages/patient/LivraisonsPage'))
const AgendaPage = lazy(() => import('./pages/medecin/AgendaPage'))
const PrescriptionsPage = lazy(() => import('./pages/medecin/PrescriptionsPage'))
const PrescriptionNewPage = lazy(() => import('./pages/medecin/PrescriptionNewPage'))
const ConsultationPage = lazy(() => import('./pages/ConsultationPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const PharmacieFichePage = lazy(() => import('./pages/pharmacie/PharmacieFichePage'))
const CommandesPage = lazy(() => import('./pages/pharmacie/CommandesPage'))
const StockPage = lazy(() => import('./pages/pharmacie/StockPage'))
const PolicesPage = lazy(() => import('./pages/assureur/PolicesPage'))
const DemandesPage = lazy(() => import('./pages/assureur/DemandesPage'))
const MentionsLegalesPage = lazy(() =>
  import('./pages/legal/LegalPages').then((m) => ({ default: m.MentionsLegalesPage })),
)
const ConfidentialitePage = lazy(() =>
  import('./pages/legal/LegalPages').then((m) => ({ default: m.ConfidentialitePage })),
)
const CGUPage = lazy(() => import('./pages/legal/LegalPages').then((m) => ({ default: m.CGUPage })))

/** Page d'accueil : redirige chaque utilisateur vers l'espace de son rôle. */
function HomeRedirect() {
  const { session, profile, loading, profileError } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/connexion" replace />
  if (profileError || !profile) return <ProfileErrorScreen />
  return <Navigate to={roleHomePath(profile.role)} replace />
}

/** Raccourci : route protégée par rôle avec Suspense. */
function Guard({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  return <ProtectedRoute allowedRoles={roles}>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public */}
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/inscription" element={<RegisterPage />} />
            <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
            <Route path="/confidentialite" element={<ConfidentialitePage />} />
            <Route path="/cgu" element={<CGUPage />} />

            {/* Redirection par rôle */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Espace patient */}
            <Route path="/patient" element={<Guard roles={['patient']}><PatientDashboard /></Guard>} />
            <Route path="/patient/profil" element={<Guard roles={['patient']}><PatientProfilePage /></Guard>} />
            <Route path="/patient/rendez-vous" element={<Guard roles={['patient']}><BookAppointmentPage /></Guard>} />
            <Route path="/patient/ordonnances" element={<Guard roles={['patient']}><OrdonnancesPage /></Guard>} />
            <Route path="/patient/livraisons" element={<Guard roles={['patient']}><LivraisonsPage /></Guard>} />

            {/* Espace médecin */}
            <Route path="/medecin" element={<Guard roles={['medecin']}><MedecinDashboard /></Guard>} />
            <Route path="/medecin/agenda" element={<Guard roles={['medecin']}><AgendaPage /></Guard>} />
            <Route path="/medecin/prescriptions" element={<Guard roles={['medecin']}><PrescriptionsPage /></Guard>} />
            <Route path="/medecin/prescriptions/nouvelle" element={<Guard roles={['medecin']}><PrescriptionNewPage /></Guard>} />

            {/* Consultation vidéo & messagerie (patient + médecin) */}
            <Route path="/consultation/:id" element={<Guard roles={['patient', 'medecin']}><ConsultationPage /></Guard>} />
            <Route path="/messages" element={<Guard roles={['patient', 'medecin']}><MessagesPage /></Guard>} />

            {/* Espace pharmacie */}
            <Route path="/pharmacie" element={<Guard roles={['pharmacie']}><PharmacieDashboard /></Guard>} />
            <Route path="/pharmacie/fiche" element={<Guard roles={['pharmacie']}><PharmacieFichePage /></Guard>} />
            <Route path="/pharmacie/commandes" element={<Guard roles={['pharmacie']}><CommandesPage /></Guard>} />
            <Route path="/pharmacie/stock" element={<Guard roles={['pharmacie']}><StockPage /></Guard>} />

            {/* Espace assureur */}
            <Route path="/assureur" element={<Guard roles={['assureur']}><AssureurDashboard /></Guard>} />
            <Route path="/assureur/polices" element={<Guard roles={['assureur']}><PolicesPage /></Guard>} />
            <Route path="/assureur/demandes" element={<Guard roles={['assureur']}><DemandesPage /></Guard>} />

            {/* Espace admin */}
            <Route path="/admin" element={<Guard roles={['admin']}><AdminDashboard /></Guard>} />
            <Route path="/admin/parametres" element={<Guard roles={['admin']}><AdminSettingsPage /></Guard>} />

            {/* Toute autre URL → accueil */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
