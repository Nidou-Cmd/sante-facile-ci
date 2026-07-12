import { ROLE_LABELS, type UserRole } from '../types/auth'

const STYLES: Record<UserRole, string> = {
  patient: 'bg-sky-100 text-sky-800',
  medecin: 'bg-emerald-100 text-emerald-800',
  pharmacie: 'bg-violet-100 text-violet-800',
  assureur: 'bg-amber-100 text-amber-800',
  admin: 'bg-rose-100 text-rose-800',
}

export default function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}
