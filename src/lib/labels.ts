import type {
  AppointmentStatus,
  CoverageStatus,
  DeliveryStatus,
  PrescriptionStatus,
} from './database.types'

interface StatusStyle {
  label: string
  cls: string
}

export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusStyle> = {
  en_attente: { label: 'En attente', cls: 'bg-amber-100 text-amber-800' },
  confirme: { label: 'Confirmé', cls: 'bg-emerald-100 text-emerald-800' },
  annule: { label: 'Annulé', cls: 'bg-gray-100 text-gray-600' },
  termine: { label: 'Terminé', cls: 'bg-sky-100 text-sky-800' },
}

export const PRESCRIPTION_STATUS: Record<PrescriptionStatus, StatusStyle> = {
  emise: { label: 'Émise', cls: 'bg-amber-100 text-amber-800' },
  en_preparation: { label: 'En préparation', cls: 'bg-violet-100 text-violet-800' },
  en_livraison: { label: 'En livraison', cls: 'bg-sky-100 text-sky-800' },
  livree: { label: 'Livrée', cls: 'bg-emerald-100 text-emerald-800' },
  annulee: { label: 'Annulée', cls: 'bg-gray-100 text-gray-600' },
}

export const DELIVERY_STATUS: Record<DeliveryStatus, StatusStyle> = {
  preparation: { label: 'En préparation', cls: 'bg-violet-100 text-violet-800' },
  en_route: { label: 'En route', cls: 'bg-sky-100 text-sky-800' },
  livre: { label: 'Livré', cls: 'bg-emerald-100 text-emerald-800' },
}

export const COVERAGE_STATUS: Record<CoverageStatus, StatusStyle> = {
  en_attente: { label: 'En attente', cls: 'bg-amber-100 text-amber-800' },
  approuvee_totale: { label: 'Approuvée (totale)', cls: 'bg-emerald-100 text-emerald-800' },
  approuvee_partielle: { label: 'Approuvée (partielle)', cls: 'bg-teal-100 text-teal-800' },
  refusee: { label: 'Refusée', cls: 'bg-red-100 text-red-700' },
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}
