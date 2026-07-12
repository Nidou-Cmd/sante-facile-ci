import { Link } from 'react-router-dom'

interface ModuleCardLinkProps {
  to: string
  icon: string
  title: string
  description: string
  badge?: string
}

/** Carte de fonctionnalité ACTIVE (cliquable) sur les tableaux de bord. */
export default function ModuleCardLink({ to, icon, title, description, badge }: ModuleCardLinkProps) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border-2 border-emerald-500 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          {badge ?? 'Disponible'}
        </span>
      </div>
      <h3 className="mt-3 font-bold text-gray-900 group-hover:text-emerald-700">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-600">Ouvrir →</p>
    </Link>
  )
}
