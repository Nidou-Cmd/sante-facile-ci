import type { Profile, UserRole } from '../lib/database.types'

export type { Profile, UserRole }

/** Rôles autorisés à l'inscription publique — 'admin' est exclu (promotion manuelle en SQL). */
export type SignUpRole = Exclude<UserRole, 'admin'>

export const ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Patient',
  medecin: 'Médecin',
  pharmacie: 'Pharmacie',
  assureur: 'Assureur',
  admin: 'Administrateur',
}

export interface SignUpRoleOption {
  value: SignUpRole
  label: string
  icon: string
  description: string
  nameLabel: string
  namePlaceholder: string
  needsVerification: boolean
}

export const SIGNUP_ROLE_OPTIONS: SignUpRoleOption[] = [
  {
    value: 'patient',
    label: 'Patient',
    icon: '🧑🏾',
    description: 'Je consulte un médecin sans me déplacer',
    nameLabel: 'Nom complet',
    namePlaceholder: 'Ex : Aya Koné',
    needsVerification: false,
  },
  {
    value: 'medecin',
    label: 'Médecin',
    icon: '🩺',
    description: 'Je consulte à distance et je prescris en ligne',
    nameLabel: 'Nom complet (Dr)',
    namePlaceholder: 'Ex : Dr Jean Kouassi',
    needsVerification: true,
  },
  {
    value: 'pharmacie',
    label: 'Pharmacie',
    icon: '💊',
    description: 'Je reçois des e-prescriptions et je livre',
    nameLabel: "Nom de l'officine",
    namePlaceholder: 'Ex : Pharmacie de Cocody',
    needsVerification: true,
  },
  {
    value: 'assureur',
    label: 'Assureur',
    icon: '🛡️',
    description: "Je gère l'éligibilité et les prises en charge",
    nameLabel: "Nom de l'organisme",
    namePlaceholder: 'Ex : Mutuelle Santé CI',
    needsVerification: true,
  },
]

/** Chemin du tableau de bord correspondant à chaque rôle. */
export function roleHomePath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    patient: '/patient',
    medecin: '/medecin',
    pharmacie: '/pharmacie',
    assureur: '/assureur',
    admin: '/admin',
  }
  return paths[role]
}
