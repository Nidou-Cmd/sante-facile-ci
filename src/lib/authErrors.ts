// Traduction en français des messages d'erreur Supabase Auth les plus courants.
export function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Un compte existe déjà avec cette adresse e-mail.'
  if (m.includes('email not confirmed'))
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter (lien reçu par e-mail).'
  if (m.includes('password should be at least')) return 'Le mot de passe est trop court.'
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Adresse e-mail invalide.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Trop de tentatives. Patientez quelques minutes puis réessayez.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Connexion au serveur impossible. Vérifiez votre connexion internet et vos variables .env.'
  return `Erreur : ${message}`
}
