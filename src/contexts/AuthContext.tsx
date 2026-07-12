import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Profile, SignUpRole } from '../types/auth'

interface SignUpParams {
  email: string
  password: string
  fullName: string
  phone: string
  role: SignUpRole
  /** Horodatage ISO de l'acceptation des CGU (preuve de consentement). */
  acceptedTermsAt: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** true tant que la session initiale ou le profil sont en cours de chargement */
  loading: boolean
  /** true si l'utilisateur est connecté mais que son profil est introuvable (script SQL non exécuté ?) */
  profileError: boolean
  signUp: (params: SignUpParams) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Charge le profil avec quelques tentatives : juste après l'inscription,
 * le trigger SQL de création de profil peut avoir un léger délai.
 */
async function fetchProfileWithRetry(userId: string, attempts = 3): Promise<Profile | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (data) return data
    if (error) console.error('Erreur de chargement du profil :', error.message)
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 700))
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initialising, setInitialising] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState(false)

  useEffect(() => {
    // 1. Session existante au chargement de la page
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitialising(false)
    })
    // 2. Écoute des changements (connexion, déconnexion, refresh de token…)
    //    Important : ne PAS faire d'appels Supabase directement dans ce
    //    callback (risque de blocage) — on met à jour la session, et un
    //    useEffect séparé se charge de récupérer le profil.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileError(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    setProfileError(false)
    fetchProfileWithRetry(userId).then((loadedProfile) => {
      if (cancelled) return
      setProfile(loadedProfile)
      setProfileError(loadedProfile === null)
      setProfileLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const signUp = useCallback(async ({ email, password, fullName, phone, role, acceptedTermsAt }: SignUpParams) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Métadonnées lues par le trigger SQL handle_new_user
        data: { full_name: fullName, phone, role, accepted_terms_at: acceptedTermsAt },
      },
    })
    // Si la confirmation d'e-mail est activée côté Supabase, aucune
    // session n'est créée immédiatement : l'utilisateur doit cliquer
    // sur le lien reçu par e-mail.
    return { error, needsEmailConfirmation: !error && !data.session }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const loadedProfile = await fetchProfileWithRetry(userId, 1)
    if (loadedProfile) setProfile(loadedProfile)
  }, [userId])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: initialising || profileLoading,
      profileError,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, initialising, profileLoading, profileError, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>')
  return ctx
}
