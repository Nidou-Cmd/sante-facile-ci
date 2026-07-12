interface ModuleCardProps {
  icon: string
  title: string
  description: string
  moduleNumber: number
}

/** Carte "fonctionnalité à venir" affichée sur les tableaux de bord placeholders. */
export default function ModuleCard({ icon, title, description, moduleNumber }: ModuleCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
          Module {moduleNumber}
        </span>
      </div>
      <h3 className="mt-3 font-bold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-600">
        Bientôt disponible
      </p>
    </div>
  )
}
