import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { roleHomePath, type UserRole } from '../types/auth'
import LoadingScreen from './LoadingScreen'
import ProfileErrorScreen from './ProfileErrorScreen'

interface ProtectedRouteProps {
  allowedRoles: UserRole[]
  children: ReactNode
}

/**
 * Garde de route par rôle :
 * - non connecté            → redirection /connexion
 * - profil introuvable      → écran d'erreur explicite
 * - rôle non autorisé ici   → redirection vers SON tableau de bord
 */
export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { session, profile, loading, profileError } = useAuth()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/connexion" replace />
  if (profileError || !profile) return <ProfileErrorScreen />
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={roleHomePath(profile.role)} replace />
  }

  return <>{children}</>
}
